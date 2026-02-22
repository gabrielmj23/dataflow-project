import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { isAuthTokenPayload, toUserSelectFromTokenPayload } from "./auth.types";

export function authGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== "string") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (!isAuthTokenPayload(decoded)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = toUserSelectFromTokenPayload(decoded);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
