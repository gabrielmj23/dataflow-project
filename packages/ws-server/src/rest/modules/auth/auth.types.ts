import type { UserSelect } from "../users/users.types";

export type AuthTokenPayload = {
  sub: string;
  name: string;
  email: string;
  iat?: number;
  exp?: number;
};

export function isAuthTokenPayload(value: unknown): value is AuthTokenPayload {
  if (typeof value !== "object" || value == null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === "string" &&
    typeof payload.name === "string" &&
    typeof payload.email === "string"
  );
}

export function toUserSelectFromTokenPayload(
  payload: AuthTokenPayload,
): UserSelect {
  return {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
  };
}
