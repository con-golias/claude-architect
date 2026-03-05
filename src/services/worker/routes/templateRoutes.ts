/**
 * Template API routes — list and retrieve architecture templates.
 *
 * @module templateRoutes
 */

import type { Router, Request, Response } from "express";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, basename } from "path";
import { getTemplatesDir } from "../../../utils/paths";

/**
 * Register template-related routes.
 *
 * @param router - Express router
 */
export function registerTemplateRoutes(router: Router): void {
  // List all available templates
  router.get("/api/templates", (_req: Request, res: Response) => {
    const templatesDir = getTemplatesDir();
    if (!existsSync(templatesDir)) {
      res.json({ templates: [] });
      return;
    }

    const files = readdirSync(templatesDir)
      .filter(f => f.endsWith(".md"))
      .sort();

    const templates = files.map(f => ({
      id: basename(f, ".md"),
      name: basename(f, ".md").replace(/-TEMPLATE$/, "").replace(/-/g, " "),
      filename: f,
    }));

    res.json({ templates });
  });

  // Get a specific template by name
  router.get("/api/templates/:name", (req: Request, res: Response) => {
    const templatesDir = getTemplatesDir();
    const name = req.params.name;

    // Prevent path traversal
    if (name.includes("..") || name.includes("/") || name.includes("\\")) {
      res.status(400).json({ error: "Invalid template name" });
      return;
    }

    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const filePath = join(templatesDir, fileName);

    if (!existsSync(filePath)) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const content = readFileSync(filePath, "utf-8");
    res.json({
      id: basename(filePath, ".md"),
      name: basename(filePath, ".md").replace(/-TEMPLATE$/, "").replace(/-/g, " "),
      content,
    });
  });
}
