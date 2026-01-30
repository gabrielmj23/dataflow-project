import type { Edge, Node } from "@xyflow/react";

import type { MicrobitConnection } from "@/microbit/types";
import {
  getMicrobitTransport,
  onMicrobitMessage,
} from "@/microbit/connection-manager";
import type { DfpFrame } from "@/microbit/protocol";
import { encodeDfpLine, parseDfpLine } from "@/microbit/protocol";
import {
  bytesToHex,
  compileSubflowToDfbc1,
  crc32,
  decodeValueHex,
  encodeArgsHex,
} from "@/microbit/dfbc1";

const DEFAULT_MAX_CHUNK = 32;
// micro:bit UART/BLE stacks often have short line buffers; keep CHUNK lines small.
const SAFE_MAX_CHUNK = 8;
const COMPACT_DEPLOY_CHUNK = 1;
const COMPACT_ARGS_CHUNK = 2;
const DEFAULT_TIMEOUT_MS = 90000;
const DFP_LOG_PREFIX = "[DFP1]";

type FrameWaiter = {
  predicate: (frame: DfpFrame) => boolean;
  resolve: (frame: DfpFrame) => void;
  reject: (err: Error) => void;
  timeoutId: number;
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createFrameRouter(params: {
  signal?: AbortSignal;
  maxQueue?: number;
}) {
  const { signal, maxQueue = 256 } = params;

  const queue: DfpFrame[] = [];
  const waiters: FrameWaiter[] = [];

  const off = onMicrobitMessage((msg) => {
    const parsed = parseDfpLine(msg);
    if (!parsed.ok) return;
    const frame = parsed.frame as DfpFrame;
    logDfp("recv", frame);

    for (let i = 0; i < waiters.length; i++) {
      const w = waiters[i];
      if (!w.predicate(frame)) continue;
      waiters.splice(i, 1);
      window.clearTimeout(w.timeoutId);
      w.resolve(frame);
      return;
    }

    queue.push(frame);
    if (queue.length > maxQueue) queue.splice(0, queue.length - maxQueue);
  });

  const onAbort = () => {
    while (waiters.length) {
      const w = waiters.pop();
      if (!w) continue;
      window.clearTimeout(w.timeoutId);
      w.reject(new Error("Abortado"));
    }
    queue.length = 0;
  };

  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  const dispose = () => {
    off();
    if (signal) signal.removeEventListener("abort", onAbort);
    while (waiters.length) {
      const w = waiters.pop();
      if (!w) continue;
      window.clearTimeout(w.timeoutId);
      w.reject(new Error("Cancelado"));
    }
    queue.length = 0;
  };

  const waitFor = (params: {
    predicate: (frame: DfpFrame) => boolean;
    timeoutMs?: number;
  }): Promise<DfpFrame> => {
    const { predicate, timeoutMs = DEFAULT_TIMEOUT_MS } = params;

    for (let i = 0; i < queue.length; i++) {
      const frame = queue[i];
      if (!predicate(frame)) continue;
      queue.splice(i, 1);
      return Promise.resolve(frame);
    }

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("Abortado"));
        return;
      }

      const timeoutId = window.setTimeout(() => {
        const idx = waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(new Error("Timeout esperando respuesta de micro:bit"));
      }, timeoutMs);

      waiters.push({ predicate, resolve, reject, timeoutId });
    });
  };

  const purge = (predicate: (frame: DfpFrame) => boolean) => {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (predicate(queue[i])) queue.splice(i, 1);
    }
  };

  return { waitFor, purge, dispose };
}

function logDfp(direction: "send" | "recv", frame: DfpFrame) {
  const payloadText = frame.payload ? JSON.stringify(frame.payload) : "";
  const marker = direction === "send" ? "→" : "←";
  const summary = `${DFP_LOG_PREFIX} ${marker} ${frame.type} #${frame.seq}`;
  if (payloadText) {
    console.info(summary, frame.payload);
  } else {
    console.info(summary);
  }
}

function hexToAsciiString(hex: string | undefined): string {
  if (!hex) return "";
  const clean = hex.trim();
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (!Number.isFinite(byte)) break;
    out += String.fromCharCode(byte & 0xff);
  }
  return out;
}

async function sendAndWaitAck(params: {
  connection: MicrobitConnection;
  frame: DfpFrame;
  waitFor: (params: {
    predicate: (frame: DfpFrame) => boolean;
    timeoutMs?: number;
  }) => Promise<DfpFrame>;
  purge?: (predicate: (frame: DfpFrame) => boolean) => void;
  timeoutMs?: number;
  retries?: number;
}): Promise<void> {
  const { connection, frame, waitFor, purge, timeoutMs, retries = 0 } = params;

  const isAckForFrame = (ack: DfpFrame): boolean => {
    if (ack.type !== "ACK") return false;

    // Preferred: echo the request sequence in the ACK header.
    if (ack.seq === frame.seq) return true;

    // Some firmwares may include an explicit reference instead.
    const ref = ack.payload?.ACK ?? ack.payload?.SEQ ?? ack.payload?.REF;
    if (
      ref !== undefined &&
      ref !== null &&
      String(ref) === String(frame.seq)
    ) {
      return true;
    }

    // If there is NO reference field, accept the next ACK (we only send one
    // request at a time). This supports firmwares that use their own seq for ACK.
    if (
      ack.payload &&
      ("ACK" in ack.payload || "SEQ" in ack.payload || "REF" in ack.payload)
    ) {
      return false;
    }
    return true;
  };

  let attempt = 0;
  while (true) {
    // Avoid matching stale ACKs from prior operations.
    purge?.((f) => f.type === "ACK");

    logDfp("send", frame);
    await connection.send(encodeDfpLine(frame));

    try {
      const ack = await waitFor({
        predicate: isAckForFrame,
        timeoutMs,
      });

      const ok = String(ack.payload?.OK ?? "0") === "1";
      if (ok) return;

      const err = String(ack.payload?.ERR ?? "UNKNOWN");
      const msg = hexToAsciiString(String(ack.payload?.MSG_HEX ?? ""));
      throw new Error(`micro:bit ACK error: ${err}${msg ? ` · ${msg}` : ""}`);
    } catch (e) {
      if (attempt >= retries) throw e;
      attempt += 1;
      await sleepMs(50);
      continue;
    }
  }
}

async function fetchHello(params: {
  connection: MicrobitConnection;
  seq: number;
  waitFor: (params: {
    predicate: (frame: DfpFrame) => boolean;
    timeoutMs?: number;
  }) => Promise<DfpFrame>;
}): Promise<{ maxChunk: number; maxProg?: number }> {
  const { connection, seq, waitFor } = params;
  logDfp("send", { type: "HELLO_REQ", seq });
  await connection.send(encodeDfpLine({ type: "HELLO_REQ", seq }));

  const hello = await waitFor({
    predicate: (f) => f.type === "HELLO_RES" && f.seq === seq,
  });

  const maxChunk = Number(hello.payload?.MAX_CHUNK ?? DEFAULT_MAX_CHUNK);
  const maxProg = Number(hello.payload?.MAX_PROG ?? 0);

  return {
    maxChunk:
      Number.isFinite(maxChunk) && maxChunk > 0 ? maxChunk : DEFAULT_MAX_CHUNK,
    maxProg: Number.isFinite(maxProg) && maxProg > 0 ? maxProg : undefined,
  };
}

export async function sendSubflowToMicrobit(params: {
  connection: MicrobitConnection;
  nodes: Node[];
  edges: Edge[];
  selectedInputs: Array<{ nodeId: string; portId: string }>;
  outputSources: Array<{ nodeId: string; portId: string }>;
  args: unknown[];
  programId: string;
  signal?: AbortSignal;
}): Promise<unknown> {
  const {
    connection,
    nodes,
    edges,
    selectedInputs,
    outputSources,
    args,
    programId,
    signal,
  } = params;

  const router = createFrameRouter({ signal });

  try {
    const transport = getMicrobitTransport();
    // Some micro:bit UART stacks truncate host->device frames near ~20 chars.
    // Use ultra-compact deploy frames on both serial and BLE.
    const useCompactDeploy =
      transport === "bluetooth" || transport === "serial";

    const compiled = compileSubflowToDfbc1({
      nodes,
      edges,
      selectedInputs,
      outputSources,
    });

    const bytecode = compiled.bytecode;
    const bytecodeHex = bytesToHex(bytecode);
    const crc = crc32(bytecode);

    let seq = Math.floor(Math.random() * 1000) + 1;

    let maxChunk = DEFAULT_MAX_CHUNK;
    try {
      const hello = await fetchHello({
        connection,
        seq: seq++,
        waitFor: router.waitFor,
      });
      maxChunk = hello.maxChunk;
    } catch {
      // ignore hello failures, use defaults
    }

    if (useCompactDeploy) {
      maxChunk = COMPACT_DEPLOY_CHUNK;
      console.info(`${DFP_LOG_PREFIX} usando compact deploy CHUNK=${maxChunk}`);
    } else {
      if (maxChunk <= 0) maxChunk = DEFAULT_MAX_CHUNK;
      // Clamp to safe size regardless of what the device advertises.
      maxChunk = Math.min(maxChunk, SAFE_MAX_CHUNK);
      console.info(`${DFP_LOG_PREFIX} usando CHUNK=${maxChunk}`);
    }

    if (useCompactDeploy) {
      await sendAndWaitAck({
        connection,
        frame: {
          type: "B",
          seq: 0,
          payload: {
            // base36 to keep it short
            L: bytecode.length.toString(36),
            C: String(maxChunk),
          },
        },
        waitFor: router.waitFor,
        purge: router.purge,
        timeoutMs: 3000,
        retries: 1,
      });
    } else {
      await sendAndWaitAck({
        connection,
        frame: {
          type: "BEGIN",
          seq: seq++,
          payload: {
            LEN: bytecode.length,
            CHUNK: maxChunk,
            PROG: programId,
          },
        },
        waitFor: router.waitFor,
        purge: router.purge,
        timeoutMs: 3000,
        retries: 1,
      });
    }

    for (let offset = 0; offset < bytecode.length; offset += maxChunk) {
      const chunk = bytecodeHex
        .slice(offset * 2, (offset + maxChunk) * 2)
        .toLowerCase();

      if (useCompactDeploy) {
        const off36 = offset.toString(36);
        // Compact payload: X=O<off36>H<hex>
        await sendAndWaitAck({
          connection,
          frame: {
            type: "C",
            seq: 0,
            payload: {
              X: `O${off36}H${chunk}`,
            },
          },
          waitFor: router.waitFor,
          purge: router.purge,
          timeoutMs: 3000,
          retries: 1,
        });
      } else {
        await sendAndWaitAck({
          connection,
          frame: {
            type: "CHUNK",
            seq: seq++,
            payload: {
              OFF: offset,
              HEX: chunk,
            },
          },
          waitFor: router.waitFor,
          purge: router.purge,
          timeoutMs: 3000,
          retries: 1,
        });
      }
    }

    if (useCompactDeploy) {
      await sendAndWaitAck({
        connection,
        frame: {
          type: "M",
          seq: 0,
          payload: {
            // CRC32 in base36 keeps it short. Firmware infers LEN from received chunks.
            R: (crc >>> 0).toString(36),
          },
        },
        waitFor: router.waitFor,
        purge: router.purge,
        timeoutMs: 5000,
        retries: 1,
      });
    } else {
      await sendAndWaitAck({
        connection,
        frame: {
          type: "COMMIT",
          seq: seq++,
          payload: {
            LEN: bytecode.length,
            CRC32: crc,
            PROG: programId,
          },
        },
        waitFor: router.waitFor,
        purge: router.purge,
        timeoutMs: 5000,
        retries: 1,
      });
    }

    // Give the device a tiny breather after CRC/commit.
    await sleepMs(50);

    const argsHex = encodeArgsHex(args);

    const runId = useCompactDeploy
      ? seq.toString(36)
      : `r${Date.now().toString(36)}`;

    if (useCompactDeploy) {
      // Stream args in tiny frames to avoid truncation.
      for (let i = 0; i < argsHex.length; i += COMPACT_ARGS_CHUNK) {
        const part = argsHex.slice(i, i + COMPACT_ARGS_CHUNK);
        await sendAndWaitAck({
          connection,
          frame: {
            type: "A",
            seq: 0,
            payload: {
              I: runId,
              X: part,
            },
          },
          waitFor: router.waitFor,
          purge: router.purge,
          timeoutMs: 3000,
          retries: 1,
        });
      }
    }

    await sendAndWaitAck({
      connection,
      frame: useCompactDeploy
        ? {
            type: "R",
            seq: seq++,
            payload: {
              I: runId,
            },
          }
        : {
            type: "RUN",
            seq: seq++,
            payload: {
              RUN: runId,
              ARGS_HEX: argsHex,
              PROG: programId,
            },
          },
      waitFor: router.waitFor,
      purge: router.purge,
    });

    if (signal?.aborted) {
      try {
        await sendAndWaitAck({
          connection,
          frame: { type: "STOP", seq: seq++, payload: { RUN: runId } },
          waitFor: router.waitFor,
          purge: router.purge,
        });
      } catch {
        // ignore
      }
      throw new Error("Abortado");
    }

    let resultFrame: DfpFrame;
    try {
      resultFrame = await router.waitFor({
        predicate: (f) =>
          f.type === "RESULT" &&
          (String(f.payload?.RUN ?? "") === runId ||
            String(f.payload?.I ?? "") === runId),
        timeoutMs: DEFAULT_TIMEOUT_MS * 2,
      });
    } catch (e) {
      // Best-effort STOP to avoid piling up runs and crashing the device.
      try {
        await sendAndWaitAck({
          connection,
          frame: { type: "STOP", seq: seq++, payload: { RUN: runId } },
          waitFor: router.waitFor,
          purge: router.purge,
        });
      } catch {
        // ignore
      }
      throw e;
    }

    const valueHex = String(resultFrame.payload?.VAL_HEX ?? "");
    return decodeValueHex(valueHex);
  } finally {
    router.dispose();
  }
}
