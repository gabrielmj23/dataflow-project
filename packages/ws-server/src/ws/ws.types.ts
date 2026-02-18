import { WebSocket } from "ws";

export type Role = "runner" | "controller";

export type Client = {
  id: string;
  role: Role;
  sessionKey: string;
  socket: WebSocket;
  lastSeenMs: number;
  name?: string;
};

export type Session = {
  key: string;
  runner: Client | null;
  controllers: Map<string, Client>;
};

export type AnyMessage = Record<string, unknown> & { type?: unknown };

export type HelloMessage = {
  type: "hello";
  role: Role;
  protocol: number;
  sessionKey: string;
  clientName?: string;
  hubName?: string;
};

export type WebSocketHubOptions = {
  maxPayloadBytes: number;
};
