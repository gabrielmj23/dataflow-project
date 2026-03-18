import { FirePatterns, NodeDefinition } from "../program-elements";

import {
  ensureMicrobitConnected,
  onMicrobitMessage,
  type MicrobitTransport,
} from "@/microbit/connection-manager";
import type { EngineObserver } from "../engine";

const MICROBIT_SEND_TIMEOUT_MS = 50000;
const MICROBIT_RESPONSE_TIMEOUT_MS = 50000;
const MICROBIT_DIGITAL_PINS = [
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
  "P11",
  "P12",
  "P13",
  "P14",
  "P15",
  "P16",
] as const;
const MICROBIT_ANALOG_READ_PINS = [
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "P10",
] as const;

type MicrobitPinMode = "digital" | "analog";

function formatValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sanitizeTransport(value: unknown): MicrobitTransport {
  return value === "bluetooth" ? "bluetooth" : "serial";
}

function sanitizePinName(
  value: unknown,
  mode: MicrobitPinMode,
  operation: "read" | "write",
): (typeof MICROBIT_DIGITAL_PINS)[number] {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const allowedPins =
    mode === "analog" && operation === "read"
      ? (MICROBIT_ANALOG_READ_PINS as readonly string[])
      : (MICROBIT_DIGITAL_PINS as readonly string[]);
  return allowedPins.includes(raw)
    ? (raw as (typeof MICROBIT_DIGITAL_PINS)[number])
    : "P0";
}

function sanitizePinMode(value: unknown): MicrobitPinMode {
  return value === "analog" ? "analog" : "digital";
}

function createAbortError(): Error {
  try {
    return new DOMException("Aborted", "AbortError") as unknown as Error;
  } catch {
    const err = new Error("Aborted");
    (err as { name?: string }).name = "AbortError";
    return err;
  }
}

function createTimeoutError(message: string): Error {
  const err = new Error(message);
  (err as { name?: string }).name = "TimeoutError";
  return err;
}

async function withTimeout<T>(params: {
  promise: Promise<T>;
  timeoutMs: number;
  signal?: AbortSignal;
  message: string;
}): Promise<T> {
  const { promise, timeoutMs, signal, message } = params;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await promise;
  }

  return await new Promise<T>((resolve, reject) => {
    let settled = false;

    function cleanup(onAbort?: () => void) {
      window.clearTimeout(timeoutId);
      if (onAbort) {
        signal?.removeEventListener("abort", onAbort);
      }
    }

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup(onAbort);
      reject(createAbortError());
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup(onAbort);
      reject(createTimeoutError(message));
    }, timeoutMs);

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        cleanup(onAbort);
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        cleanup(onAbort);
        reject(error);
      });
  });
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

function parsePrefixedNumber(message: string, prefix: string): number | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  const regex = new RegExp(`^${prefix}\\s*:`, "i");
  if (!regex.test(trimmed)) return null;
  const raw = trimmed.replace(regex, "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parsePrefixedText(message: string, prefix: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  const regex = new RegExp(`^${prefix}\\s*:`, "i");
  if (!regex.test(trimmed)) return null;
  return trimmed.replace(regex, "");
}

function parsePinReadMessage(message: string): number | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (!upper.startsWith("PINR:")) return null;

  const rawPayload = trimmed.slice(5).trim();
  if (!rawPayload) return null;

  const direct = Number(rawPayload);
  if (Number.isFinite(direct)) return direct;

  const parts = rawPayload
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const last = Number(parts[parts.length - 1]);
  return Number.isFinite(last) ? last : null;
}

function coercePinWriteValue(value: unknown, mode: MicrobitPinMode): number {
  const numeric = Number(value);
  if (mode === "analog") {
    const analog = Number.isFinite(numeric) ? numeric : 0;
    return Math.max(0, Math.min(1023, Math.round(analog)));
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "on") return 1;
    if (normalized === "false" || normalized === "off") return 0;
  }
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, Math.round(numeric)));
}

async function waitForPinReadValue(params: {
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const signal = params.signal;
    const timeoutMs =
      typeof params.timeoutMs === "number"
        ? params.timeoutMs
        : MICROBIT_RESPONSE_TIMEOUT_MS;

    const cleanup = (
      onAbort?: () => void,
      off?: () => void,
      onTimeout?: () => void,
    ) => {
      if (onAbort) {
        signal?.removeEventListener("abort", onAbort);
      }
      if (onTimeout) {
        window.clearTimeout(timeoutId);
      }
      if (off) off();
    };

    const off = onMicrobitMessage((msg) => {
      const parsed = parsePinReadMessage(msg);
      if (parsed == null) return;
      cleanup(onAbort, off, onTimeout);
      resolve(parsed);
    });

    const onAbort = () => {
      cleanup(onAbort, off, onTimeout);
      reject(createAbortError());
    };

    const onTimeout = () => {
      cleanup(onAbort, off, onTimeout);
      reject(
        createTimeoutError(
          "Tiempo de espera agotado esperando respuesta de la micro:bit.",
        ),
      );
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    const timeoutId = window.setTimeout(onTimeout, timeoutMs);
  });
}

function coerceFiniteNumber(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} inválido.`);
  }
  return n;
}

async function waitForPrefixedNumber(params: {
  prefix: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const signal = params.signal;
    const timeoutMs =
      typeof params.timeoutMs === "number"
        ? params.timeoutMs
        : MICROBIT_RESPONSE_TIMEOUT_MS;

    const cleanup = (
      onAbort?: () => void,
      off?: () => void,
      onTimeout?: () => void,
    ) => {
      if (onAbort) {
        signal?.removeEventListener("abort", onAbort);
      }
      if (onTimeout) {
        window.clearTimeout(timeoutId);
      }
      if (off) off();
    };

    const off = onMicrobitMessage((msg) => {
      const parsed = parsePrefixedNumber(msg, params.prefix);
      if (parsed == null) return;
      cleanup(onAbort, off, onTimeout);
      resolve(parsed);
    });

    const onAbort = () => {
      cleanup(onAbort, off, onTimeout);
      reject(createAbortError());
    };

    const onTimeout = () => {
      cleanup(onAbort, off, onTimeout);
      reject(
        createTimeoutError(
          "Tiempo de espera agotado esperando respuesta de la micro:bit.",
        ),
      );
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    const timeoutId = window.setTimeout(onTimeout, timeoutMs);
  });
}

async function waitForPrefixedText(params: {
  prefix: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const signal = params.signal;
    const timeoutMs =
      typeof params.timeoutMs === "number"
        ? params.timeoutMs
        : MICROBIT_RESPONSE_TIMEOUT_MS;

    const cleanup = (
      onAbort?: () => void,
      off?: () => void,
      onTimeout?: () => void,
    ) => {
      if (onAbort) {
        signal?.removeEventListener("abort", onAbort);
      }
      if (onTimeout) {
        window.clearTimeout(timeoutId);
      }
      if (off) off();
    };

    const off = onMicrobitMessage((msg) => {
      const parsed = parsePrefixedText(msg, params.prefix);
      if (parsed == null) return;
      cleanup(onAbort, off, onTimeout);
      resolve(parsed);
    });

    const onAbort = () => {
      cleanup(onAbort, off, onTimeout);
      reject(createAbortError());
    };

    const onTimeout = () => {
      cleanup(onAbort, off, onTimeout);
      reject(
        createTimeoutError(
          "Tiempo de espera agotado esperando respuesta de la micro:bit.",
        ),
      );
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    const timeoutId = window.setTimeout(onTimeout, timeoutMs);
  });
}

export class EngineMicrobitWriteNode extends NodeDefinition {
  constructor(params: { transport?: unknown; signal?: AbortSignal } = {}) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (value: unknown) => {
        const connection = await ensureMicrobitConnected({ transport });
        const text = formatValue(value).trim();
        const payload = `TXT:${text}`;
        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });
        return undefined;
      },
      [FirePatterns.EXISTS],
      ["input1"],
      {
        kind: "microbitWrite",
      },
    );
  }
}

export class EngineMicrobitSoundNode extends NodeDefinition {
  constructor(params: { transport?: unknown; signal?: AbortSignal } = {}) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (frequencyValue: unknown, durationValue: unknown) => {
        const connection = await ensureMicrobitConnected({ transport });
        const freq = Number(frequencyValue);
        const rawFrequency = formatValue(frequencyValue).trim();
        if (!Number.isFinite(freq)) {
          throw new Error(`Frecuencia inválida: '${rawFrequency}'`);
        }

        const rawDuration = formatValue(durationValue).trim();
        const parsedDuration = Number(durationValue);
        if (!Number.isFinite(parsedDuration)) {
          throw new Error(`Duración inválida: '${rawDuration}'`);
        }
        const ms = Math.max(10, Math.floor(parsedDuration));

        const payload = `SND:${Math.floor(freq)},${ms}`;
        console.log(`[microbit-sound] Sending payload: ${payload}`);
        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });
        return undefined;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2"],
      {
        kind: "microbitSound",
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineMicrobitWritePinNode extends NodeDefinition {
  constructor(
    params: {
      transport?: unknown;
      pin?: unknown;
      mode?: unknown;
      signal?: AbortSignal;
    } = {},
  ) {
    const transport = sanitizeTransport(params.transport);
    const mode = sanitizePinMode(params.mode);
    const pin = sanitizePinName(params.pin, mode, "write");

    super(
      async (value: unknown) => {
        const connection = await ensureMicrobitConnected({ transport });
        const safeValue = coercePinWriteValue(value, mode);
        const payload = `PINW:${pin},${mode},${safeValue}`;

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        return undefined;
      },
      [FirePatterns.EXISTS],
      ["input1"],
      {
        kind: "microbitWritePin",
      },
    );
  }
}

export class EngineMicrobitReadPinNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport: MicrobitTransport;
    pin?: unknown;
    mode?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const mode = sanitizePinMode(params.mode);
    const pin = sanitizePinName(params.pin, mode, "read");

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
              ? `Leyendo ${pin} (${mode}, Bluetooth)…`
              : `Leyendo ${pin} (${mode}, Serial)…`,
        });

        await withTimeout({
          promise: connection.send(`PINR?:${pin},${mode}`),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        return await waitForPinReadValue({
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
      },
      [FirePatterns.ALWAYS],
      ["output"],
      {
        kind: "microbitReadPin",
        skipStepDelay: true,
      },
    );
  }
}

export class EngineMicrobitSumNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (a: number, b: number) => {
        const left = coerceFiniteNumber(a, "Entrada 1");
        const right = coerceFiniteNumber(b, "Entrada 2");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `SUM:${left},${right}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando suma (Bluetooth)…"
              : "Calculando suma (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "SUM",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        kind: "microbitSum",
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineMicrobitSubtractNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (a: number, b: number) => {
        const left = coerceFiniteNumber(a, "Entrada 1");
        const right = coerceFiniteNumber(b, "Entrada 2");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `SUB:${left},${right}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando resta (Bluetooth)…"
              : "Calculando resta (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "SUB",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        kind: "microbitSubtract",
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineMicrobitMultiplyNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (a: number, b: number) => {
        const left = coerceFiniteNumber(a, "Entrada 1");
        const right = coerceFiniteNumber(b, "Entrada 2");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `MUL:${left},${right}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando multiplicación (Bluetooth)…"
              : "Calculando multiplicación (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "MUL",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        kind: "microbitMultiply",
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineMicrobitDivideNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (a: number, b: number) => {
        const left = coerceFiniteNumber(a, "Entrada 1");
        const right = coerceFiniteNumber(b, "Entrada 2");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `DIV:${left},${right}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando división (Bluetooth)…"
              : "Calculando división (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "DIV",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        kind: "microbitDivide",
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineMicrobitModNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (a: number, b: number) => {
        const left = coerceFiniteNumber(a, "Entrada 1");
        const right = coerceFiniteNumber(b, "Entrada 2");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `MOD:${left},${right}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando módulo (Bluetooth)…"
              : "Calculando módulo (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "MOD",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        kind: "microbitMod",
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineMicrobitPowerNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (a: number, b: number) => {
        const left = coerceFiniteNumber(a, "Entrada 1");
        const right = coerceFiniteNumber(b, "Entrada 2");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `POW:${left},${right}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando potencia (Bluetooth)…"
              : "Calculando potencia (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "POW",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        kind: "microbitPower",
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineMicrobitFloorNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (value: number) => {
        const input = coerceFiniteNumber(value, "Entrada");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `FLOOR:${input}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando piso (Bluetooth)…"
              : "Calculando piso (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "FLOOR",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS],
      ["input1", "output"],
      {
        kind: "microbitFloor",
        stickyInputPorts: ["input1"],
      },
    );
  }
}

export class EngineMicrobitCeilingNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (value: number) => {
        const input = coerceFiniteNumber(value, "Entrada");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `CEIL:${input}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando techo (Bluetooth)…"
              : "Calculando techo (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "CEIL",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS],
      ["input1", "output"],
      {
        kind: "microbitCeiling",
        stickyInputPorts: ["input1"],
      },
    );
  }
}

export class EngineMicrobitRoundNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (value: number) => {
        const input = coerceFiniteNumber(value, "Entrada");

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `ROUND:${input}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Calculando redondeo (Bluetooth)…"
              : "Calculando redondeo (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "ROUND",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS],
      ["input1", "output"],
      {
        kind: "microbitRound",
        stickyInputPorts: ["input1"],
      },
    );
  }
}

export class EngineMicrobitConcatNode extends NodeDefinition {
  constructor(params: {
    nodeId: string;
    transport?: unknown;
    onLog?: EngineObserver["onLog"];
    signal?: AbortSignal;
  }) {
    const transport = sanitizeTransport(params.transport);

    super(
      async (a: unknown, b: unknown) => {
        const left = formatValue(a);
        const right = formatValue(b);

        const connection = await ensureMicrobitConnected({ transport });
        const payload = `CONCAT:${left}|${right}`;

        params.onLog?.({
          level: "info",
          nodeId: params.nodeId,
          message: "microbit",
          data:
            transport === "bluetooth"
              ? "Concatenando (Bluetooth)…"
              : "Concatenando (Serial)…",
        });

        await withTimeout({
          promise: connection.send(payload),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedText({
          prefix: "CONCAT",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });
        void connection;
        return result;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        kind: "microbitConcat",
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
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
      ["output"],
      { skipStepDelay: true },
    );
  }
}

export class EngineMicrobitReadTemperatureNode extends NodeDefinition {
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
              ? "Leyendo temperatura (Bluetooth)…"
              : "Leyendo temperatura (Serial)…",
        });

        await withTimeout({
          promise: connection.send("TEMP?"),
          timeoutMs: MICROBIT_SEND_TIMEOUT_MS,
          signal: params.signal,
          message: "Tiempo de espera agotado enviando datos a la micro:bit.",
        });

        const result = await waitForPrefixedNumber({
          prefix: "TEMP",
          signal: params.signal,
          timeoutMs: MICROBIT_RESPONSE_TIMEOUT_MS,
        });

        return result;
      },
      [FirePatterns.ALWAYS],
      ["output"],
      {
        kind: "microbitReadTemperature",
        skipStepDelay: true,
      },
    );
  }
}
