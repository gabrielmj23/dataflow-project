import express from "express";

import type { RestApiOptions } from "../types.ts";

export function createRestApp(options: RestApiOptions): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/sessions", (_req, res) => {
    res.status(200).json({ sessions: options.getSessionsSnapshot() });
  });

  app.get("/sessions/:sessionKey", (req, res) => {
    const sessionKey = req.params.sessionKey?.trim();
    if (!sessionKey) {
      res.status(400).json({ error: "missing sessionKey" });
      return;
    }

    const session = options.getSessionSnapshot(sessionKey);
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }

    res.status(200).json(session);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}
