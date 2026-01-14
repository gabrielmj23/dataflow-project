import { FirePatterns, NodeDefinition } from "../program-elements";
import { microbitSlotManager } from "@/microbit/slot-manager";

function formatValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sanitizeSlot(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(8, Math.max(1, Math.floor(n)));
}

function sanitizeConn(value: unknown): "bluetooth" | "serial" {
  return value === "serial" ? "serial" : "bluetooth";
}

export class EngineMicrobitWriteNode extends NodeDefinition {
  constructor(params: { slot?: unknown; connectionType?: unknown } = {}) {
    const slot = sanitizeSlot(params.slot);
    const connectionType = sanitizeConn(params.connectionType);

    super(
      async (value: unknown) => {
        const text = formatValue(value).trim();
        const payload = `TXT:${text}`;
        await microbitSlotManager.send({ slot, data: payload });
        return undefined;
      },
      [FirePatterns.EXISTS],
      ["input1"],
      {
        kind: "microbitWrite",
        microbitSlot: slot,
        connectionType,
      }
    );
  }
}

export class EngineMicrobitSoundNode extends NodeDefinition {
  constructor(params: { slot?: unknown; connectionType?: unknown } = {}) {
    const slot = sanitizeSlot(params.slot);
    const connectionType = sanitizeConn(params.connectionType);

    super(
      async (value: unknown) => {
        // Accept either number (frequency) or "freq,duration".
        const raw = formatValue(value).trim();
        let freq = Number(raw);
        let ms = 250;

        if (!Number.isFinite(freq)) {
          const parts = raw.split(",").map((p) => p.trim());
          if (parts.length >= 1) {
            const f = Number(parts[0]);
            if (Number.isFinite(f)) freq = f;
          }
          if (parts.length >= 2) {
            const d = Number(parts[1]);
            if (Number.isFinite(d)) ms = Math.max(10, Math.floor(d));
          }
        }

        if (!Number.isFinite(freq)) {
          throw new Error(`Frecuencia inválida: '${raw}'`);
        }

        const payload = `SND:${Math.floor(freq)},${ms}`;
        await microbitSlotManager.send({ slot, data: payload });
        return undefined;
      },
      [FirePatterns.EXISTS],
      ["input1"],
      {
        kind: "microbitSound",
        microbitSlot: slot,
        connectionType,
      }
    );
  }
}
