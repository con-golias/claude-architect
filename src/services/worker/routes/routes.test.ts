/**
 * Integration tests for Express API routes.
 * Uses in-memory SQLite and ephemeral HTTP server per test suite.
 *
 * @module routes.test
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import express, { Router } from "express";
import { runMigrations } from "../../sqlite/migrations";
import { registerProjectRoutes } from "./projectRoutes";
import { registerArchitectRoutes } from "./architectRoutes";
import { registerSearchRoutes } from "./searchRoutes";
import { registerDataRoutes } from "./dataRoutes";
import { registerDashboardRoutes } from "./dashboardRoutes";
import { registerTemplateRoutes } from "./templateRoutes";
import { registerCodeInfoRoutes } from "./codeInfoRoutes";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Helper to avoid 'unknown' type from res.json() in strict mode */
async function json(res: Response): Promise<any> {
  return res.json();
}

let db: Database;
let app: ReturnType<typeof express>;
let baseUrl: string;
let server: ReturnType<ReturnType<typeof express>["listen"]>;

beforeEach((done) => {
  db = new Database(":memory:");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  runMigrations(db);

  app = express();
  app.use(express.json());
  const router = Router();

  registerProjectRoutes(router, db);
  registerArchitectRoutes(router, db);
  registerSearchRoutes(router, db);
  registerDataRoutes(router, db);
  registerDashboardRoutes(router, db);
  registerTemplateRoutes(router);
  registerCodeInfoRoutes(router);

  app.use(router);

  server = app.listen(0, () => {
    const addr = server.address();
    baseUrl = `http://localhost:${typeof addr === "object" ? addr?.port : 0}`;
    done();
  });
});

afterEach((done) => {
  server.close(() => done());
  db.close();
});

// --- Health ---

describe("GET /api/health", () => {
  test("returns 200 with healthy status", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("claude-architect");
    expect(typeof body.timestamp).toBe("string");
  });
});

// --- Check ---

describe("GET /api/check", () => {
  test("returns 400 without project_path", async () => {
    const res = await fetch(`${baseUrl}/api/check`);
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toContain("project_path");
  });
});

// --- Projects ---

describe("GET /api/projects", () => {
  test("returns empty array initially", async () => {
    const res = await fetch(`${baseUrl}/api/projects`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});

describe("POST /api/projects", () => {
  test("returns 400 when fields are missing", async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  test("creates project and returns it in list", async () => {
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "test-proj",
        name: "Test Project",
        path: "/tmp/test-project",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await json(createRes);
    expect(created.id).toBe("test-proj");
    expect(created.name).toBe("Test Project");

    const listRes = await fetch(`${baseUrl}/api/projects`);
    const projects = await json(listRes);
    expect(projects.length).toBe(1);
    expect(projects[0].id).toBe("test-proj");
  });
});

// --- Rules ---

describe("GET /api/rules", () => {
  test("returns rules object with array", async () => {
    const res = await fetch(`${baseUrl}/api/rules`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveProperty("rules");
    expect(Array.isArray(body.rules)).toBe(true);
    // Rules directory exists in this repo, so we expect at least some rules
    expect(body.rules.length).toBeGreaterThan(0);
  });

  test("each rule has id, name, mode, content", async () => {
    const res = await fetch(`${baseUrl}/api/rules`);
    const body = await json(res);
    if (body.rules.length > 0) {
      const rule = body.rules[0];
      expect(typeof rule.id).toBe("string");
      expect(typeof rule.name).toBe("string");
      expect(typeof rule.mode).toBe("string");
      expect(typeof rule.content).toBe("string");
    }
  });
});

// --- Templates ---

describe("GET /api/templates", () => {
  test("returns templates object with array", async () => {
    const res = await fetch(`${baseUrl}/api/templates`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveProperty("templates");
    expect(Array.isArray(body.templates)).toBe(true);
  });
});

// --- Scaffold ---

describe("POST /api/scaffold", () => {
  test("returns 400 without required fields", async () => {
    const res = await fetch(`${baseUrl}/api/scaffold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toContain("required");
  });
});

// --- Status ---

describe("GET /api/status", () => {
  test("returns 400 without project_path", async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toContain("project_path");
  });

  test("returns unregistered status for unknown project", async () => {
    const res = await fetch(`${baseUrl}/api/status?project_path=/nonexistent`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.registered).toBe(false);
  });
});

// --- Search ---

describe("GET /api/search", () => {
  test("returns empty results without project", async () => {
    const res = await fetch(`${baseUrl}/api/search`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});

// --- Batch details ---

describe("POST /api/details/batch", () => {
  test("returns 400 without required fields", async () => {
    const res = await fetch(`${baseUrl}/api/details/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  test("returns empty array for nonexistent IDs", async () => {
    const res = await fetch(`${baseUrl}/api/details/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [999], type: "decisions" }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});
