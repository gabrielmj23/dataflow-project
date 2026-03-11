import crypto from "node:crypto";
import type { Request, Response } from "express";
import { getAuthUserFromRequest } from "../auth/auth.guard";
import type { UserSelect } from "../users/users.types";

const PROJECT_GUEST_COOKIE_NAME = "nodi_project_guest";
const PROJECT_GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;
const GUEST_OWNER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProjectViewerIdentity =
  | { kind: "user"; user: UserSelect }
  | { kind: "guest"; guestOwnerId: string }
  | { kind: "anonymous" };

function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return cookies;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (!name || !value) {
        return cookies;
      }

      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }

      return cookies;
    }, {});
}

function normalizeGuestOwnerId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!GUEST_OWNER_ID_PATTERN.test(trimmedValue)) {
    return null;
  }

  return trimmedValue;
}

export function getGuestOwnerIdFromRequest(req: Request): string | null {
  const requestValue = normalizeGuestOwnerId(req.projectGuestOwnerId);
  if (requestValue) {
    return requestValue;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieValue = normalizeGuestOwnerId(cookies[PROJECT_GUEST_COOKIE_NAME]);
  if (cookieValue) {
    req.projectGuestOwnerId = cookieValue;
    return cookieValue;
  }

  return null;
}

export function setGuestOwnerCookie(res: Response, guestOwnerId: string) {
  const encodedValue = encodeURIComponent(guestOwnerId);
  const cookieParts = [
    `${PROJECT_GUEST_COOKIE_NAME}=${encodedValue}`,
    "Path=/",
    `Max-Age=${PROJECT_GUEST_COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (process.env.NODE_ENV === "production") {
    cookieParts.push("Secure");
  }

  res.append("Set-Cookie", cookieParts.join("; "));
}

export function ensureGuestOwnerIdentity(req: Request, res: Response): string {
  const existingGuestOwnerId = getGuestOwnerIdFromRequest(req);
  if (existingGuestOwnerId) {
    return existingGuestOwnerId;
  }

  const guestOwnerId = crypto.randomUUID();
  req.projectGuestOwnerId = guestOwnerId;
  setGuestOwnerCookie(res, guestOwnerId);
  return guestOwnerId;
}

export function resolveProjectViewerIdentity(
  req: Request,
): ProjectViewerIdentity {
  const authUser = getAuthUserFromRequest(req);
  if (authUser) {
    req.user = authUser;
    return { kind: "user", user: authUser };
  }

  const guestOwnerId = getGuestOwnerIdFromRequest(req);
  if (guestOwnerId) {
    return { kind: "guest", guestOwnerId };
  }

  return { kind: "anonymous" };
}
