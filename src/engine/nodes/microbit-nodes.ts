import { FirePatterns, NodeDefinition } from "../program-elements";

import {
  ensureMicrobitConnected,
  onMicrobitMessage,
  type MicrobitTransport,
} from "@/microbit/connection-manager";
import type { EngineObserver } from "../engine";

function createAbortError(): Error {
  try {
    return new DOMException("Aborted", "AbortError") as unknown as Error;
  } catch {
    const err = new Error("Aborted");
    (err as { name?: string }).name = "AbortError";
    return err;
  }
}

function parseButtonMessage(message: string): "A" | "B" | "AB" | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();

  // Accept a few friendly formats:
  // - BTN:A / BTN:B / BTN:AB
  // - BUTTON:A ...
  // - A / B / AB
  const direct = upper === "A" || upper === "B" || upper === "AB";
  if (direct) return upper as "A" | "B" | "AB";

  const match = /^(?:BTN|BUTTON)\s*:\s*(A|B|AB)$/.exec(upper);
  if (!match) return null;
  const btn = match[1];
  return btn === "A" || btn === "B" || btn === "AB"
    ? (btn as "A" | "B" | "AB")
    : null;
}

export class EngineMicrobitReadButtonNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport: MicrobitTransport;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    super(
      async () => {
        const connection = await ensureMicrobitConnected({
          transport: params.transport,
        });

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            params.transport === "bluetooth"
              ? "Esperando botón (Bluetooth)…"
              : "Esperando botón (Serial)…",
        });

        return await new Promise<string>((resolve, reject) => {
          const signal = params.signal;

          const cleanup = (onAbort?: () => void, off?: () => void) => {
            if (onAbort) {
              signal?.removeEventListener("abort", onAbort);
            }
            if (off) off();
          };

          const off = onMicrobitMessage((msg) => {
            const parsed = parseButtonMessage(msg);
            if (!parsed) return;
            cleanup(onAbort, off);
            resolve(parsed);
          });

          const onAbort = () => {
            cleanup(onAbort, off);
            reject(createAbortError());
          };

          if (signal?.aborted) {
            onAbort();
            return;
          }

          signal?.addEventListener("abort", onAbort, { once: true });

          // Ensure connection exists (keeps TS from tree-shaking it away)
          void connection;
        });
      },
      [FirePatterns.ALWAYS],
      ["output"]
    );
  }
}
