import http from "node:http";
import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import process from "node:process";

import { WebSocketServer, WebSocket } from "ws";

/**
 * WebSocket hub server (protocol v1).
 *
 * Purpose
 * - Provide a lightweight relay between a single **runner** (the hub browser running the engine)
 *   and multiple **controllers** (remote browsers that only send control commands and receive
 *   logs/state).
 *
 * Non-goals
 * - This server does NOT run the dataflow engine.
 * - This server does NOT interact with micro:bit hardware.
 *
 * Transport
 * - HTTP is used only for a basic healthcheck endpoint (`/health`).
 * - WebSocket is used for all runtime messaging.
 *
 * Security model (current)
 * - Minimal: clients join a session via a shared `sessionKey`.
 * - There is no authentication/authorization beyond that shared key.
 *
 * Environment variables
 * - `WS_HOST` (default `0.0.0.0`)
 * - `WS_PORT` or `PORT` (default `8787`)
 * - `WS_MAX_MESSAGE_BYTES` (default `1000000`)
 */

/**
 * Logical client role.
 *
 * - `runner`: the hub instance (typically a browser tab) that executes the engine.
 * - `controller`: remote clients that can request actions and observe state.
 */
type Role = "runner" | "controller";

/**
 * Connected WebSocket client tracked by the hub.
 *
 * `lastSeenMs` is updated whenever the server receives a message from the client.
 * A periodic heartbeat will close connections that have gone silent.
 */
type Client = {
  id: string;
  role: Role;
  sessionKey: string;
  socket: WebSocket;
  lastSeenMs: number;
  name?: string;
};

/**
 * Session groups one runner with multiple controllers.
 *
 * The session is identified by `key` (shared `sessionKey`).
 */
type Session = {
  key: string;
  runner: Client | null;
  controllers: Map<string, Client>;
};

/**
 * Best-effort representation of a JSON message.
 *
 * We accept unknown properties but require a string `type` at runtime.
 */
type AnyMessage = Record<string, unknown> & { type?: unknown };

/**
 * Initial handshake message.
 *
 * First message from every WebSocket client MUST be a `hello`.
 */
type HelloMessage = {
  type: "hello";
  role: Role;
  protocol: number;
  sessionKey: string;
  clientName?: string;
  hubName?: string;
};

/** Protocol version supported by this server. */
const PROTOCOL_VERSION = 1;

/** Returns the current time in milliseconds since epoch. */
function nowMs(): number {
  return Date.now();
}

/**
 * Converts an unknown value to a human-readable string.
 *
 * Used mostly for best-effort network debugging fields.
 */
function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

/**
 * Parses a JSON string.
 *
 * Separated for easier testing/mocking and to keep message handling readable.
 */
function safeJsonParse(text: string): unknown {
  return JSON.parse(text);
}

/** Runtime guard for the Role union. */
function isRole(value: unknown): value is Role {
  return value === "runner" || value === "controller";
}

/**
 * Validates and normalizes the initial `hello` handshake.
 *
 * Throws an Error if:
 * - `type` is not `hello`
 * - `role` is invalid
 * - `protocol` is not supported
 * - `sessionKey` is missing/empty
 */
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

/**
 * Sends a JSON message to a socket (no-op if not open).
 */
function wsSend(socket: WebSocket, obj: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(obj));
}

/**
 * Closes a WebSocket with a code/reason.
 *
 * Best-effort: ignores failures (e.g. already closed).
 */
function wsClose(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // ignore
  }
}

/** In-memory session registry, keyed by `sessionKey`. */
const sessions = new Map<string, Session>();

/**
 * Returns an existing session by key or creates a new one.
 */
function getOrCreateSession(key: string): Session {
  const existing = sessions.get(key);
  if (existing) return existing;
  const next: Session = { key, runner: null, controllers: new Map() };
  sessions.set(key, next);
  return next;
}

/**
 * Removes a client from its session and performs the required cleanup.
 *
 * When the runner disconnects, all controllers are notified via `runner_status`.
 * If a session becomes empty, it is deleted.
 */
function removeClient(client: Client): void {
  const session = sessions.get(client.sessionKey);
  if (!session) return;

  if (client.role === "runner") {
    if (session.runner?.id === client.id) session.runner = null;
    // Notify controllers that runner went away
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

/** Broadcasts a message to all controllers in a session. */
function broadcastToControllers(session: Session, msg: unknown): void {
  for (const c of session.controllers.values()) {
    wsSend(c.socket, msg);
  }
}

/** Forwards a message to the session runner (no-op if no runner connected). */
function forwardToRunner(session: Session, msg: unknown): void {
  if (!session.runner) return;
  wsSend(session.runner.socket, msg);
}

/** Returns a serializable list of connected controllers. */
function getControllersList(
  session: Session,
): Array<{ id: string; name?: string }> {
  const list: Array<{ id: string; name?: string }> = [];
  for (const c of session.controllers.values()) {
    list.push({ id: c.id, ...(c.name ? { name: c.name } : {}) });
  }
  return list;
}

/** Sends the current controller list to the runner, if connected. */
function sendControllersList(session: Session): void {
  if (!session.runner) return;
  wsSend(session.runner.socket, {
    type: "controllers_list",
    controllers: getControllersList(session),
  });
}

/** Host/IP to bind the HTTP+WS server to. */
const HOST = process.env.WS_HOST?.trim() || "0.0.0.0";
/** Port to bind the HTTP+WS server to. */
const PORT = Number(process.env.WS_PORT || process.env.PORT || 8787);
/** Maximum accepted WebSocket message size in bytes. */
const MAX_MESSAGE_BYTES = Number(process.env.WS_MAX_MESSAGE_BYTES || 1_000_000);

if (!Number.isFinite(PORT) || PORT <= 0) {
  throw new Error("Invalid WS_PORT/PORT");
}

const server = http.createServer((req, res) => {
  // Basic health endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });

wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
  const remote = toText(req.socket.remoteAddress);
  const clientId = randomUUID();

  let client: Client | null = null;
  let helloDone = false;

  /** Updates the liveness timestamp for the connected client. */
  const touch = () => {
    if (client) client.lastSeenMs = nowMs();
  };

  /** Sends an error frame to the client and closes the socket. */
  const sendErrorAndClose = (reason: string) => {
    wsSend(socket, { type: "error", message: reason });
    wsClose(socket, 1008, reason);
  };

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

    // First message must be hello
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
          // Replace any existing runner
          if (session.runner && session.runner.socket !== socket) {
            wsSend(session.runner.socket, {
              type: "error",
              message: "Another runner connected; you were replaced.",
            });
            wsClose(session.runner.socket, 1012, "runner replaced");
          }
          session.runner = client;
          // Inform controllers
          broadcastToControllers(session, {
            type: "runner_status",
            connected: true,
          });
          sendControllersList(session);
        } else {
          session.controllers.set(client.id, client);
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

        return;
      } catch (err) {
        sendErrorAndClose(err instanceof Error ? err.message : "hello failed");
        return;
      }
    }

    // After hello: route messages.
    if (!client) {
      sendErrorAndClose("not initialized");
      return;
    }

    const session = sessions.get(client.sessionKey);
    if (!session) {
      sendErrorAndClose("session missing");
      return;
    }

    // Controllers can only send control-ish messages.
    if (client.role === "controller") {
      if (
        type === "control" ||
        type === "get_snapshot" ||
        type === "prompt_reply"
      ) {
        forwardToRunner(session, { ...parsed, controllerId: client.id });
        return;
      }

      if (type === "exec_result") {
        forwardToRunner(session, { ...parsed, controllerId: client.id });
        return;
      }

      wsSend(socket, {
        type: "error",
        message: `controllers cannot send ${type}`,
      });
      return;
    }

    // Runner can broadcast engine events + acks.
    if (client.role === "runner") {
      if (type === "get_controllers") {
        sendControllersList(session);
        return;
      }

      if (type === "exec_request") {
        const controllerId =
          typeof parsed.controllerId === "string" ? parsed.controllerId : "";
        const requestId =
          typeof parsed.requestId === "string" ? parsed.requestId : "";
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
          wsSend(socket, {
            type: "exec_result",
            requestId,
            ok: false,
            error: "controller not connected",
            controllerId,
          });
          return;
        }

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
        broadcastToControllers(session, parsed);
        return;
      }

      wsSend(socket, { type: "error", message: `runner cannot send ${type}` });
      return;
    }
  });

  socket.on("close", () => {
    if (client) removeClient(client);
  });

  socket.on("error", () => {
    // Close handler will clean up.
  });
});

// Heartbeat: close dead sockets.
/** Interval at which we ping and check client liveness. */
const HEARTBEAT_MS = 15_000;
/** Time without inbound messages after which a client is considered dead. */
const DEAD_AFTER_MS = 45_000;
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
        // best effort ping
        try {
          c.socket.ping();
        } catch {
          // ignore
        }
      }
    }
  }
}, HEARTBEAT_MS).unref();

server.listen(PORT, HOST, () => {
  console.log(`[ws-server] listening on http://${HOST}:${PORT}`);

  console.log(`[ws-server] ws endpoint: ws://${HOST}:${PORT}`);
});
