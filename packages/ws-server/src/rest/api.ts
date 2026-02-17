import express from "express";
import type { RestApiOptions } from "../types.ts";
import { usersRouter } from "./modules/users/users.controller.js";
import { authRouter } from "./modules/auth/auth.controller.js";
import { authGuard } from "./modules/auth/auth.guard.js";

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

  app.use("/users", authGuard, usersRouter);

  app.use("/auth", authRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}
