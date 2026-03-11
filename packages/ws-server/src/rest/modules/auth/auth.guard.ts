import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { isAuthTokenPayload, toUserSelectFromTokenPayload } from "./auth.types";

export function getAuthUserFromRequest(req: Request) {
  try {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== "string") {
      return null;
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    if (!isAuthTokenPayload(decoded)) {
      return null;
    }

    return toUserSelectFromTokenPayload(decoded);
  } catch {
    return null;
  }
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = user;
  next();
}
