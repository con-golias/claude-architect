/**
 * API route registration — delegates to focused route modules.
 *
 * @module routes
 */

import type { Express } from "express";
import { Router } from "express";
import { getDatabase } from "../sqlite/Database";
import { registerProjectRoutes } from "./routes/projectRoutes";
import { registerArchitectRoutes } from "./routes/architectRoutes";
import { registerSearchRoutes } from "./routes/searchRoutes";
import { registerDataRoutes } from "./routes/dataRoutes";
import { registerDashboardRoutes } from "./routes/dashboardRoutes";
import { registerTemplateRoutes } from "./routes/templateRoutes";
import { registerCodeInfoRoutes } from "./routes/codeInfoRoutes";

/**
 * Register all API routes on the Express app.
 *
 * @param app - Express application instance
 */
export function registerRoutes(app: Express): void {
  const db = getDatabase();
  const router = Router();

  registerProjectRoutes(router, db);
  registerArchitectRoutes(router, db);
  registerSearchRoutes(router, db);
  registerDataRoutes(router, db);
  registerDashboardRoutes(router, db);
  registerTemplateRoutes(router);
  registerCodeInfoRoutes(router);

  app.use(router);
}
