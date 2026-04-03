/**
 * KB API routes — search, lookup, read, and manage the Knowledge Base index.
 *
 * @module kb-routes
 */

import type { Router, Request, Response } from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve, normalize } from "path";
import { lookup, loadIndex, clearCache } from "../../kb/KbLookup";
import { buildIndex } from "../../kb/KbIndexBuilder";
import { getKbDir, getKbIndexPath } from "../../../utils/paths";

/**
 * Register KB routes on the router.
 */
export function registerKbRoutes(router: Router): void {
  /**
   * GET /api/kb/lookup — Find relevant KB articles for a coding context.
   * Query: file_path (required), query?, category?, language?, limit?
   */
  router.get("/api/kb/lookup", (req: Request, res: Response) => {
    const filePath = (req.query.file_path as string) || "";
    const query = req.query.query as string | undefined;
    const category = req.query.category as string | undefined;
    const language = req.query.language as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!filePath && !query) {
      res.status(400).json({ error: "file_path or query is required" });
      return;
    }

    const results = lookup(filePath || "unknown.ts", undefined, query, {
      limit: Math.min(limit, 50),
      category,
      language,
    });

    res.json({ results, total: results.length });
  });

  /**
   * GET /api/kb/read/:id(*) — Read full content of a KB article.
   * The :id uses a wildcard to support paths with slashes.
   */
  router.get("/api/kb/read/*", (req: Request, res: Response) => {
    // Extract the ID from the URL (everything after /api/kb/read/)
    const id = req.params[0] || req.url.split("/api/kb/read/")[1]?.split("?")[0] || "";

    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }

    const decodedId = decodeURIComponent(id);
    const index = loadIndex();
    if (!index) {
      res.status(503).json({ error: "KB index not available" });
      return;
    }

    const entry = index.entries[decodedId];
    if (!entry) {
      res.status(404).json({ error: `KB article not found: ${decodedId}` });
      return;
    }

    // Read the full markdown file
    const kbDir = getKbDir();
    const filePath = join(kbDir, entry.path);
    let content = "";

    if (existsSync(filePath)) {
      content = readFileSync(filePath, "utf-8");
    }

    // Filter sections if requested
    const sectionsParam = req.query.sections as string | undefined;
    if (sectionsParam && content) {
      const requestedSections = sectionsParam.split(",").map((s) => s.trim().toLowerCase());
      content = filterSections(content, requestedSections);
    }

    res.json({ entry, content });
  });

  /**
   * GET /api/kb/search — Simple text search across KB titles, tags, and domains.
   * Query: q (required), limit?
   */
  router.get("/api/kb/search", (req: Request, res: Response) => {
    const q = (req.query.q as string || "").toLowerCase();
    const limit = parseInt(req.query.limit as string) || 20;

    if (!q) {
      res.status(400).json({ error: "q is required" });
      return;
    }

    const index = loadIndex();
    if (!index) {
      res.status(503).json({ error: "KB index not available" });
      return;
    }

    const results: Array<{ id: string; title: string; category: string; domain: string }> = [];

    for (const entry of Object.values(index.entries)) {
      if (
        entry.title.toLowerCase().includes(q) ||
        entry.domain.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.includes(q))
      ) {
        results.push({
          id: entry.id,
          title: entry.title,
          category: entry.category,
          domain: entry.domain,
        });
        if (results.length >= limit) break;
      }
    }

    res.json({ results });
  });

  /**
   * GET /api/kb/stats — KB index statistics.
   */
  router.get("/api/kb/stats", (_req: Request, res: Response) => {
    const index = loadIndex();
    if (!index) {
      res.status(503).json({ error: "KB index not available" });
      return;
    }

    const byCategory: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};

    for (const entry of Object.values(index.entries)) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      for (const lang of entry.languages) {
        byLanguage[lang] = (byLanguage[lang] || 0) + 1;
      }
    }

    res.json({
      totalEntries: index.totalFiles,
      indexVersion: index.version,
      indexBuiltAt: index.builtAt,
      kbHash: index.kbHash,
      byCategory,
      byLanguage,
    });
  });

  /**
   * POST /api/kb/create — Create a new KB article and optionally rebuild the index.
   * Body: { topic, folder_path, content, rebuild_index? }
   */
  router.post("/api/kb/create", (req: Request, res: Response) => {
    const { topic, folder_path, content, rebuild_index = true } = req.body as {
      topic?: string; folder_path?: string; content?: string; rebuild_index?: boolean;
    };

    if (!topic || !folder_path || !content) {
      res.status(400).json({ error: "topic, folder_path, and content are required" });
      return;
    }

    // Security: prevent path traversal
    if (folder_path.includes("..") || folder_path.startsWith("/")) {
      res.status(400).json({ error: "Invalid folder_path: must be relative and cannot contain .." });
      return;
    }

    const kbDir = getKbDir();
    const targetDir = resolve(join(kbDir, folder_path));

    // Ensure target is within KB directory
    if (!normalize(targetDir).startsWith(normalize(kbDir))) {
      res.status(400).json({ error: "folder_path must resolve within the KB directory" });
      return;
    }

    // Create directory if needed
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Generate filename from topic
    const fileName = topic
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60)
      + ".md";

    const filePath = join(targetDir, fileName);

    // Prevent overwriting existing files
    if (existsSync(filePath)) {
      res.status(409).json({ error: `Article already exists: ${folder_path}/${fileName}` });
      return;
    }

    // Write the article
    writeFileSync(filePath, content, "utf-8");

    // Optionally rebuild index
    let indexRebuilt = false;
    if (rebuild_index) {
      try {
        clearCache();
        buildIndex();
        indexRebuilt = true;
      } catch {
        // Index rebuild failure is non-fatal
      }
    }

    res.json({
      success: true,
      path: `${folder_path}/${fileName}`,
      indexRebuilt,
    });
  });

  /**
   * POST /api/kb/rebuild — Rebuild the KB index from source files.
   */
  router.post("/api/kb/rebuild", (_req: Request, res: Response) => {
    try {
      clearCache();
      const stats = buildIndex();
      res.json({
        success: true,
        totalEntries: stats.totalEntries,
        sizeKB: stats.sizeKB,
        buildTimeMs: stats.buildTimeMs,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Failed to rebuild KB index: ${message}` });
    }
  });
}

/** Filter markdown content to only include specified sections. */
function filterSections(content: string, sections: string[]): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let collecting = false;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(?:\d+\.\s+)?(.+)/);
    if (h2Match) {
      const header = h2Match[1].trim().toLowerCase();
      collecting = sections.some((s) => header.includes(s));
    }
    if (collecting) result.push(line);
  }

  return result.join("\n");
}
