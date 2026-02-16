import type http from "node:http";
import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";

import { WebSocketServer, WebSocket } from "ws";
import type { ControllerSnapshot, SessionSnapshot } from "./types.ts";

type Role = "runner" | "controller";

type Client = {
  id: string;
  role: Role;
  sessionKey: string;
  socket: WebSocket;
  lastSeenMs: number;
  name?: string;
};

type Session = {
  key: string;
  runner: Client | null;
  controllers: Map<string, Client>;
};

type AnyMessage = Record<string, unknown> & { type?: unknown };

type HelloMessage = {
  type: "hello";
  role: Role;
  protocol: number;
  sessionKey: string;
  clientName?: string;
  hubName?: string;
};

type WebSocketHubOptions = {
  maxPayloadBytes: number;
};

const PROTOCOL_VERSION = 1;
const HEARTBEAT_MS = 15_000;
const DEAD_AFTER_MS = 45_000;

const sessions = new Map<string, Session>();

function nowMs(): number {
  return Date.now();
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function safeJsonParse(text: string): unknown {
  return JSON.parse(text);
}

function isRole(value: unknown): value is Role {
  return value === "runner" || value === "controller";
}

function parseHello(msg: AnyMessage): HelloMessage {
  if (msg.type !== "hello") {
    throw new Error("expected hello");
  }
  const role = msg.role;
  const protocol = msg.protocol;
  const sessionKey = msg.sessionKey;

  if (!isRole(role)) throw new Error("invalid role");
  if (protocol !== PROTOCOL_VERSION) throw new Error("unsupported protocol");
  if (typeof sessionKey !== "string" || sessionKey.trim() === "") {
    throw new Error("missing sessionKey");
  }

  const out: HelloMessage = {
    type: "hello",
    role,
    protocol,
    sessionKey: sessionKey.trim(),
  };

  const clientName = msg.clientName;
  if (typeof clientName === "string" && clientName.trim()) {
    out.clientName = clientName.trim();
  }
  const hubName = msg.hubName;
  if (typeof hubName === "string" && hubName.trim()) {
    out.hubName = hubName.trim();
  }

  return out;
}

function wsSend(socket: WebSocket, obj: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(obj));
}

function wsClose(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // ignore
  }
}

function getOrCreateSession(key: string): Session {
  const existing = sessions.get(key);
  if (existing) return existing;
  const next: Session = { key, runner: null, controllers: new Map() };
  sessions.set(key, next);
  return next;
}

function getControllersList(session: Session): ControllerSnapshot[] {
  const list: ControllerSnapshot[] = [];
  for (const c of session.controllers.values()) {
    list.push({ id: c.id, ...(c.name ? { name: c.name } : {}) });
  }
  return list;
}

function sendControllersList(session: Session): void {
  if (!session.runner) return;
  wsSend(session.runner.socket, {
    type: "controllers_list",
    controllers: getControllersList(session),
  });
}

function removeClient(client: Client): void {
  const session = sessions.get(client.sessionKey);
  if (!session) return;

  if (client.role === "runner") {
    if (session.runner?.id === client.id) session.runner = null;
    for (const c of session.controllers.values()) {
      wsSend(c.socket, { type: "runner_status", connected: false });
    }
  } else {
    session.controllers.delete(client.id);
    sendControllersList(session);
  }

  if (!session.runner && session.controllers.size === 0) {
    sessions.delete(session.key);
  }
}

function broadcastToControllers(session: Session, msg: unknown): void {
  for (const c of session.controllers.values()) {
    wsSend(c.socket, msg);
  }
}

function forwardToRunner(session: Session, msg: unknown): void {
  if (!session.runner) return;
  wsSend(session.runner.socket, msg);
}

function getSessionSnapshotFromSession(session: Session): SessionSnapshot {
  return {
    sessionKey: session.key,
    runnerConnected: !!session.runner,
    controllers: getControllersList(session),
  };
}

export function getSessionsSnapshot(): SessionSnapshot[] {
  return Array.from(sessions.values()).map(getSessionSnapshotFromSession);
}

export function getSessionSnapshot(
  sessionKey: string,
): SessionSnapshot | undefined {
  const session = sessions.get(sessionKey);
  if (!session) return undefined;
  return getSessionSnapshotFromSession(session);
}

export function attachWebSocketHub(
  server: http.Server,
  options: WebSocketHubOptions,
): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    maxPayload: options.maxPayloadBytes,
  });

  wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
    const remote = toText(req.socket.remoteAddress);
    const clientId = randomUUID();

    let client: Client | null = null;
    let helloDone = false;

    const touch = () => {
      if (client) client.lastSeenMs = nowMs();
    };

    const sendErrorAndClose = (reason: string) => {
      try {
        const id = client?.id ?? clientId;
        const role = client?.role ?? "unknown";
        console.warn(
          `[ws-server] sendErrorAndClose: client=${id} role=${role} reason=${reason}`,
        );
      } catch {
        console.warn(`[ws-server] sendErrorAndClose: reason=${reason}`);
      }

      wsSend(socket, { type: "error", message: reason });
      wsClose(socket, 1008, reason);
    };

    socket.on("pong", () => {
      touch();
    });

    socket.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) {
        sendErrorAndClose("binary not supported");
        return;
      }

      touch();

      let parsed: AnyMessage;
      try {
        parsed = safeJsonParse(String(data)) as AnyMessage;
      } catch {
        sendErrorAndClose("invalid json");
        return;
      }

      const type = parsed?.type;
      if (typeof type !== "string") {
        sendErrorAndClose("missing type");
        return;
      }

      try {
        const maybeId = client?.id ?? clientId;
        const maybeRole = client?.role ?? "uninitialized";
        console.log(
          `[ws-server] message from ${maybeRole}:${maybeId} remote=${remote} type=${type}`,
        );
      } catch {
        console.log(`[ws-server] message type=${type}`);
      }

      if (!helloDone) {
        try {
          const hello = parseHello(parsed);
          const session = getOrCreateSession(hello.sessionKey);
          client = {
            id: clientId,
            role: hello.role,
            sessionKey: hello.sessionKey,
            socket,
            lastSeenMs: nowMs(),
            name: hello.clientName,
          };

          if (hello.role === "runner") {
            if (session.runner && session.runner.socket !== socket) {
              wsSend(session.runner.socket, {
                type: "error",
                message: "Another runner connected; you were replaced.",
              });
              wsClose(session.runner.socket, 1012, "runner replaced");
            }
            session.runner = client;
            console.log(
              `[ws-server] runner connected: client=${clientId} session=${session.key} name=${client.name ?? ""}`,
            );
            broadcastToControllers(session, {
              type: "runner_status",
              connected: true,
            });
            sendControllersList(session);
          } else {
            session.controllers.set(client.id, client);
            console.log(
              `[ws-server] controller connected: client=${clientId} session=${session.key} name=${client.name ?? ""}`,
            );
            sendControllersList(session);
          }

          helloDone = true;

          wsSend(socket, {
            type: "welcome",
            clientId,
            role: hello.role,
            sessionKey: hello.sessionKey,
            runnerConnected: !!session.runner,
            remote,
          });

          console.log(
            `[ws-server] welcome sent: client=${clientId} role=${hello.role} session=${hello.sessionKey}`,
          );

          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "hello failed";
          console.warn(`[ws-server] hello error: ${msg}`);
          sendErrorAndClose(msg);
          return;
        }
      }

      if (!client) {
        sendErrorAndClose("not initialized");
        return;
      }

      const session = sessions.get(client.sessionKey);
      if (!session) {
        sendErrorAndClose("session missing");
        return;
      }

      if (client.role === "controller") {
        if (
          type === "control" ||
          type === "get_snapshot" ||
          type === "prompt_reply"
        ) {
          console.log(
            `[ws-server] controller -> runner: controller=${client.id} session=${session.key} type=${type}`,
          );
          forwardToRunner(session, { ...parsed, controllerId: client.id });
          return;
        }

        if (type === "exec_result") {
          console.log(
            `[ws-server] exec_result from controller=${client.id} session=${session.key} requestId=${String(parsed.requestId ?? "")}`,
          );
          forwardToRunner(session, { ...parsed, controllerId: client.id });
          return;
        }

        console.warn(
          `[ws-server] controllers cannot send ${type} client=${client.id} session=${session.key}`,
        );
        wsSend(socket, {
          type: "error",
          message: `controllers cannot send ${type}`,
        });
        return;
      }

      if (client.role === "runner") {
        if (type === "get_controllers") {
          console.log(
            `[ws-server] runner requested controllers_list session=${session.key}`,
          );
          sendControllersList(session);
          return;
        }

        if (type === "exec_request") {
          const controllerId =
            typeof parsed.controllerId === "string" ? parsed.controllerId : "";
          const requestId =
            typeof parsed.requestId === "string" ? parsed.requestId : "";

          console.log(
            `[ws-server] exec_request from runner=${client.id} session=${session.key} requestId=${requestId} controllerId=${controllerId}`,
          );

          if (!controllerId) {
            wsSend(socket, {
              type: "exec_result",
              requestId,
              ok: false,
              error: "missing controllerId",
            });
            return;
          }

          const controller = session.controllers.get(controllerId);
          if (!controller) {
            console.warn(
              `[ws-server] exec_request: controller not connected controllerId=${controllerId} session=${session.key}`,
            );
            wsSend(socket, {
              type: "exec_result",
              requestId,
              ok: false,
              error: "controller not connected",
              controllerId,
            });
            return;
          }

          console.log(
            `[ws-server] forwarding exec_request requestId=${requestId} to controller=${controllerId}`,
          );
          wsSend(controller.socket, {
            ...parsed,
            controllerId,
          });
          return;
        }

        if (
          type === "snapshot" ||
          type === "engine_log" ||
          type === "node_status" ||
          type === "run_start" ||
          type === "run_end" ||
          type === "prompt" ||
          type === "control_ack" ||
          type === "runner_status"
        ) {
          console.log(
            `[ws-server] runner -> controllers broadcast session=${session.key} type=${type}`,
          );
          broadcastToControllers(session, parsed);
          return;
        }

        console.warn(
          `[ws-server] runner cannot send ${type} client=${client.id} session=${session.key}`,
        );
        wsSend(socket, {
          type: "error",
          message: `runner cannot send ${type}`,
        });
        return;
      }
    });

    socket.on("close", () => {
      try {
        if (client) {
          console.log(
            `[ws-server] socket close: client=${client.id} role=${client.role} session=${client.sessionKey}`,
          );
          removeClient(client);
        } else {
          console.log(
            `[ws-server] socket close: uninitialized clientId=${clientId} remote=${remote}`,
          );
        }
      } catch (err) {
        console.warn(`[ws-server] socket close handler error: ${String(err)}`);
        if (client) removeClient(client);
      }
    });

    socket.on("error", () => {
      // Close handler will clean up.
    });
  });

  setInterval(() => {
    const t = nowMs();
    for (const session of sessions.values()) {
      const all: Client[] = [];
      if (session.runner) all.push(session.runner);
      all.push(...session.controllers.values());

      for (const c of all) {
        const age = t - c.lastSeenMs;
        if (age > DEAD_AFTER_MS) {
          wsClose(c.socket, 1001, "timeout");
          removeClient(c);
        } else {
          try {
            c.socket.ping();
          } catch {
            // ignore
          }
        }
      }
    }
  }, HEARTBEAT_MS).unref();

  return wss;
}
