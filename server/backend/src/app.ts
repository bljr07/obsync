import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import type { HttpLogger, Options as PinoHttpOptions } from "pino-http";
import { filesRouter } from "./routes/files.js";
import { observabilityRouter } from "./routes/observability.js";
import { retentionRouter } from "./routes/retention.js";
import { apiKeysRouter } from "./routes/apiKeys.js";
import { authRouter } from "./routes/auth.js";
import { requireAuth } from "./middleware/auth.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(express.json({ limit: "10mb" }));
  const pinoHttpFactory = pinoHttp as unknown as (options?: PinoHttpOptions) => HttpLogger;
  app.use(pinoHttpFactory());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);

  app.use(
    "/api/v1",
    requireAuth,
    filesRouter,
    observabilityRouter,
    retentionRouter,
    apiKeysRouter
  );

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  return app;
}
