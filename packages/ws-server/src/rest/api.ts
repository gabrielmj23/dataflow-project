import express from "express";
import type { RestApiOptions } from "../types";
import { usersRouter } from "./modules/users/users.controller";
import { authRouter } from "./modules/auth/auth.controller";
import { authGuard } from "./modules/auth/auth.guard";
import { setupSwagger } from "./swagger";
import { projectsRouter } from "./modules/projects/projects.controller";
import { customNodesRouter } from "./modules/custom-nodes/custom-nodes.controller";
import { extensionsRouter } from "./modules/extensions/extensions.controller";

export function createRestApp(options: RestApiOptions): express.Express {
  const app = express();
  const allowedOrigin = process.env.REST_ALLOWED_ORIGIN?.trim();

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const requestOrigin =
      typeof req.headers.origin === "string" ? req.headers.origin : null;

    if (allowedOrigin) {
      if (requestOrigin === allowedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
        res.setHeader("Vary", "Origin");
      }
    } else if (requestOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Cookie",
    );

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });
  app.use(express.json({ limit: options.maxJsonBodyBytes }));

  setupSwagger(app);

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [System]
   *     summary: Healthcheck del servicio.
   *     responses:
   *       200:
   *         description: Servicio disponible.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok:
   *                   type: boolean
   *               required: [ok]
   */
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  /**
   * @openapi
   * /sessions:
   *   get:
   *     tags: [Sessions]
   *     summary: Lista todas las sesiones activas.
   *     responses:
   *       200:
   *         description: Lista de sesiones.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 sessions:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SessionSnapshot'
   *               required: [sessions]
   */
  app.get("/sessions", (_req, res) => {
    res.status(200).json({ sessions: options.getSessionsSnapshot() });
  });

  /**
   * @openapi
   * /sessions/{sessionKey}:
   *   get:
   *     tags: [Sessions]
   *     summary: Obtiene una sesión activa por clave.
   *     parameters:
   *       - in: path
   *         name: sessionKey
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Estado de la sesión.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SessionSnapshot'
   *       400:
   *         description: sessionKey inválido.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Sesión no encontrada.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  app.use("/auth", authRouter);

  app.use("/users", authGuard, usersRouter);

  app.use("/projects", projectsRouter);

  app.use("/nodes", customNodesRouter);
  app.use("/extensions", extensionsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}
