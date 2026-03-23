export const MICROBIT_MIN_SLOT = 1;
export const DEFAULT_MICROBIT_SLOT = 1;
export const MICROBIT_MAX_SAFE_SLOT = 9999;

export function sanitizeMicrobitSlot(value: unknown): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) return DEFAULT_MICROBIT_SLOT;

  const safe = Math.floor(parsed);
  return Math.min(MICROBIT_MAX_SAFE_SLOT, Math.max(MICROBIT_MIN_SLOT, safe));
}

export function parseMicrobitSlot(data: Record<string, unknown>): number {
  return sanitizeMicrobitSlot(data.microbitSlot ?? data.slot);
}

export function getMicrobitSlotOptions(): number[] {
  return Array.from({ length: 8 }, (_, index) => MICROBIT_MIN_SLOT + index);
}
