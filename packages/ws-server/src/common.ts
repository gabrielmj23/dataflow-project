import process from "node:process";
import type { ServerConfig } from "./types";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 8787;
const DEFAULT_MAX_MESSAGE_BYTES = 1_000_000;

function asPositiveInt(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return value;
}

export function getServerConfig(): ServerConfig {
  const host = process.env.WS_HOST?.trim() || DEFAULT_HOST;
  const port = asPositiveInt(
    Number(process.env.WS_PORT || process.env.PORT || DEFAULT_PORT),
    "WS_PORT/PORT",
  );
  const maxMessageBytes = asPositiveInt(
    Number(process.env.WS_MAX_MESSAGE_BYTES || DEFAULT_MAX_MESSAGE_BYTES),
    "WS_MAX_MESSAGE_BYTES",
  );

  return {
    host,
    port,
    maxMessageBytes,
  };
}
