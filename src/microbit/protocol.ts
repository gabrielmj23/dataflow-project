export const DFP_LINE_PREFIX = "DFP1|" as const;

export type DfpMessageType =
  | "HELLO_REQ"
  | "HELLO_RES"
  | "PING"
  | "PONG"
  | "ACK"
  // Ultra-compact deploy message types (for very small MTU links)
  | "B" // BEGIN
  | "C" // CHUNK
  | "M" // COMMIT
  | "A" // ARGS chunk (ultra-compact)
  | "R" // RUN (ultra-compact)
  // Short deploy message types (preferred)
  | "BEGIN"
  | "CHUNK"
  | "COMMIT"
  // Legacy deploy message types (accepted for compatibility)
  | "DEPLOY_BEGIN"
  | "DEPLOY_CHUNK"
  | "DEPLOY_COMMIT"
  | "RUN"
  | "STOP"
  | "RESULT"
  | "LOG";

export type DfpKeyValuePayload = Record<
  string,
  string | number | boolean | null | undefined
>;

export type DfpFrame = {
  type: DfpMessageType;
  seq: number; // 0..65535
  payload?: DfpKeyValuePayload;
};

function encodePayload(payload: DfpKeyValuePayload | undefined): string {
  if (!payload) return "";
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(payload)) {
    if (raw === undefined) continue;
    const value = raw === null ? "" : String(raw);
    parts.push(`${key}=${value}`);
  }
  return parts.join(";");
}

export function encodeDfpLine(frame: DfpFrame): string {
  const seq = Number(frame.seq);
  if (!Number.isFinite(seq) || seq < 0 || seq > 65535) {
    throw new Error("DFP seq must be 0..65535");
  }
  const payload = encodePayload(frame.payload);
  return `${DFP_LINE_PREFIX}${frame.type}|${seq}|${payload}`;
}

export type ParsedDfpLine =
  | {
      ok: true;
      frame: DfpFrame;
    }
  | {
      ok: false;
      error: string;
    };

export function parseDfpLine(line: string): ParsedDfpLine {
  const trimmed = (line ?? "").trim();
  if (!trimmed.startsWith(DFP_LINE_PREFIX)) {
    return { ok: false, error: "Not a DFP line" };
  }

  const rest = trimmed.slice(DFP_LINE_PREFIX.length);
  const [type, seqRaw, payloadRaw = ""] = rest.split("|", 3);

  if (!type || !seqRaw) {
    return { ok: false, error: "Malformed DFP header" };
  }

  const seq = Number(seqRaw);
  if (!Number.isFinite(seq) || seq < 0 || seq > 65535) {
    return { ok: false, error: "Invalid seq" };
  }

  const payload: DfpKeyValuePayload = {};
  const payloadText = payloadRaw.trim();
  if (payloadText) {
    const pairs = payloadText.split(";");
    for (const pair of pairs) {
      const [k, v = ""] = pair.split("=", 2);
      const key = (k ?? "").trim();
      if (!key) continue;
      payload[key] = v;
    }
  }

  return {
    ok: true,
    frame: {
      type: type as DfpMessageType,
      seq,
      payload,
    },
  };
}
