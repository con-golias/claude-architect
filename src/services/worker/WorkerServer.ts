/**
 * Worker HTTP API server for claude-architect.
 * Provides REST API and serves web dashboard on port 37778.
 *
 * @module WorkerServer
 */

import express from "express";
import { join } from "path";
import { existsSync } from "fs";
import { registerRoutes } from "./routes";
import { getDatabase, closeDatabase } from "../sqlite/Database";
import { loadConfig } from "../../utils/config";
import { logger } from "../../utils/logger";
import { getPluginRoot } from "../../utils/paths";

const config = loadConfig();
const PORT = config.workerPort;

/**
 * Start the Worker HTTP API server.
 * Serves the REST API and static web dashboard.
 */
function startServer(): void {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "1mb" }));

  // CORS — restrict to localhost only (dashboard runs on same host)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
    ];
    if (origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Serve web dashboard
  const uiDir = join(getPluginRoot(), "ui");
  if (existsSync(uiDir)) {
    app.use(express.static(uiDir));
  }

  // Register API routes
  registerRoutes(app);

  // Initialize database
  getDatabase();

  // Start listening
  const server = app.listen(PORT, () => {
    logger.info(`Worker server started on port ${PORT}`);
    process.stdout.write("Success");
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("Shutting down worker server");
    server.close();
    closeDatabase();
  });

  process.on("SIGINT", () => {
    server.close();
    closeDatabase();
  });
}

// CLI command routing
const command = process.argv[2];

if (command === "start") {
  startServer();
} else if (command === "hook") {
  // Route to hook handlers
  const hookName = process.argv[3];
  import(`../../cli/handlers/${hookName}`)
    .then((handler) => handler.default?.())
    .catch((err) => {
      logger.error(`Hook handler "${hookName}" failed`, {
        error: err.message,
      });
      process.stdout.write("Success");
    });
} else {
  logger.error(`Unknown command: ${command}`);
  process.exit(1);
}
