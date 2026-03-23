import { BluetoothConnection } from "@/microbit/bluetooth-connector";
import { SerialConnection } from "@/microbit/serial-connector";
import type { MicrobitConnection } from "@/microbit/types";

export type MicrobitConnectionType = "bluetooth" | "serial";

export type MicrobitSlotStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type MicrobitSlotState = {
  slot: number;
  slotName?: string;
  status: MicrobitSlotStatus;
  connectionType: MicrobitConnectionType;
  deviceLabel?: string;
  lastError?: string;
};

export type MicrobitKnownSlot = {
  slot: number;
  slotName?: string;
};

type InternalSlotState = MicrobitSlotState & {
  connection: MicrobitConnection | null;
  connectToken: number;
  snapshot: MicrobitSlotState;
};

function sanitizeSlot(slot: number): number {
  const safe = Number.isFinite(slot) ? Math.floor(slot) : 1;
  return Math.min(9999, Math.max(1, safe));
}

const SLOT_NAMES_STORAGE_KEY = "df:microbit-slot-names:v1";

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function createConnection(type: MicrobitConnectionType): MicrobitConnection {
  return type === "serial" ? new SerialConnection() : new BluetoothConnection();
}

function buildSnapshot(state: MicrobitSlotState): MicrobitSlotState {
  return {
    slot: state.slot,
    slotName: state.slotName,
    status: state.status,
    connectionType: state.connectionType,
    deviceLabel: state.deviceLabel,
    lastError: state.lastError,
  };
}

function refreshSnapshot(state: InternalSlotState): void {
  // IMPORTANT: useSyncExternalStore requires getSnapshot() to return
  // a cached (stable) value, unless the data actually changed.
  state.snapshot = buildSnapshot(state);
}

class MicrobitSlotManager {
  private listeners = new Set<() => void>();
  private slots = new Map<number, InternalSlotState>();
  private connectedSnapshots: MicrobitSlotState[] = [];
  private knownSlotsSnapshots: MicrobitKnownSlot[] = [{ slot: 1 }];
  private slotNames = new Map<number, string>();

  constructor() {
    this.loadSlotNames();
    this.refreshKnownSlotsSnapshots();
  }

  private loadSlotNames(): void {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(SLOT_NAMES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;

      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const slot = sanitizeSlot((item as { slot?: number }).slot ?? 1);
        const rawName = (item as { name?: string }).name;
        const name = typeof rawName === "string" ? rawName.trim() : "";
        if (name.length > 0) {
          this.slotNames.set(slot, name);
        }
      }
    } catch {
      // Ignore malformed persisted data.
    }
  }

  private persistSlotNames(): void {
    if (typeof window === "undefined") return;

    try {
      const payload = Array.from(this.slotNames.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([slot, name]) => ({ slot, name }));
      window.localStorage.setItem(
        SLOT_NAMES_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // Persistence errors should not break runtime behavior.
    }
  }

  private refreshConnectedSnapshots(): void {
    this.connectedSnapshots = Array.from(this.slots.values())
      .filter((slot) => slot.status === "connected")
      .sort((a, b) => a.slot - b.slot)
      .map((slot) => slot.snapshot);
  }

  private refreshKnownSlotsSnapshots(): void {
    const known = new Set<number>();
    known.add(1);
    for (const slot of this.slotNames.keys()) {
      known.add(slot);
    }
    for (const slot of this.slots.keys()) {
      known.add(slot);
    }

    this.knownSlotsSnapshots = Array.from(known)
      .sort((a, b) => a - b)
      .map((slot) => ({
        slot,
        slotName: this.slotNames.get(slot),
      }));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.refreshConnectedSnapshots();
    this.refreshKnownSlotsSnapshots();
    for (const listener of this.listeners) listener();
  }

  private ensure(slot: number): InternalSlotState {
    const safeSlot = sanitizeSlot(slot);
    const existing = this.slots.get(safeSlot);
    if (existing) return existing;

    const next: InternalSlotState = {
      slot: safeSlot,
      slotName: this.slotNames.get(safeSlot),
      status: "disconnected",
      connectionType: "bluetooth",
      connection: null,
      connectToken: 0,
      snapshot: {
        slot: safeSlot,
        slotName: this.slotNames.get(safeSlot),
        status: "disconnected",
        connectionType: "bluetooth",
      },
    };
    this.slots.set(safeSlot, next);
    return next;
  }

  getSnapshot(slot: number): MicrobitSlotState {
    const s = this.ensure(slot);
    return s.snapshot;
  }

  getConnectedSnapshots(): MicrobitSlotState[] {
    return this.connectedSnapshots;
  }

  getKnownSlots(): MicrobitKnownSlot[] {
    return this.knownSlotsSnapshots;
  }

  setSlotName(params: { slot: number; name?: string }): void {
    const safeSlot = sanitizeSlot(params.slot);
    const trimmedName =
      typeof params.name === "string" ? params.name.trim() : "";

    if (trimmedName.length > 0) {
      this.slotNames.set(safeSlot, trimmedName);
    } else {
      this.slotNames.delete(safeSlot);
    }
    this.persistSlotNames();

    const state = this.ensure(safeSlot);
    state.slotName = this.slotNames.get(safeSlot);
    refreshSnapshot(state);
    this.emit();
  }

  getSlotName(slot: number): string | undefined {
    const safeSlot = sanitizeSlot(slot);
    return this.slotNames.get(safeSlot);
  }

  getConnection(slot: number): MicrobitConnection | null {
    const safeSlot = sanitizeSlot(slot);
    const s = this.ensure(safeSlot);
    if (s.status !== "connected" || !s.connection) return null;
    return s.connection;
  }

  async connect(params: {
    slot: number;
    connectionType: MicrobitConnectionType;
  }): Promise<void> {
    const safeSlot = sanitizeSlot(params.slot);
    const s = this.ensure(safeSlot);

    // If there's an existing connection of a different type, disconnect first.
    if (s.connection && s.connectionType !== params.connectionType) {
      await this.disconnect({ slot: safeSlot });
    }

    // If already connected with the same type, no-op.
    if (
      s.status === "connected" &&
      s.connection &&
      s.connectionType === params.connectionType
    ) {
      return;
    }

    const token = s.connectToken + 1;
    s.connectToken = token;
    s.status = "connecting";
    s.connectionType = params.connectionType;
    s.lastError = undefined;
    refreshSnapshot(s);
    this.emit();

    const connection = createConnection(params.connectionType);

    try {
      await connection.connect();

      // Ignore stale connects.
      const latest = this.ensure(safeSlot);
      if (latest.connectToken !== token) {
        try {
          await connection.disconnect();
        } catch {
          /* ignore */
        }
        return;
      }

      latest.connection = connection;
      latest.status = "connected";
      latest.slotName = this.slotNames.get(safeSlot);
      latest.lastError = undefined;
      // Best-effort: ask the connection for a human-readable label
      try {
        const label = connection.getDeviceLabel
          ? connection.getDeviceLabel()
          : undefined;
        latest.deviceLabel =
          label ??
          (params.connectionType === "bluetooth" ? "Bluetooth" : "Serial");
      } catch {
        latest.deviceLabel =
          params.connectionType === "bluetooth" ? "Bluetooth" : "Serial";
      }
      refreshSnapshot(latest);
      this.emit();
    } catch (error) {
      const latest = this.ensure(safeSlot);
      if (latest.connectToken === token) {
        latest.connection = null;
        latest.status = "error";
        latest.lastError = stringifyError(error);
        refreshSnapshot(latest);
        this.emit();
      }

      try {
        await connection.disconnect();
      } catch {
        /* ignore */
      }

      throw error;
    }
  }

  async disconnect(params: { slot: number }): Promise<void> {
    const safeSlot = sanitizeSlot(params.slot);
    const s = this.ensure(safeSlot);

    // Invalidate any in-flight connect.
    s.connectToken = s.connectToken + 1;

    const conn = s.connection;
    s.connection = null;
    s.status = "disconnected";
    s.deviceLabel = undefined;
    s.lastError = undefined;
    refreshSnapshot(s);
    this.emit();

    if (conn) {
      try {
        await conn.disconnect();
      } catch {
        // keep disconnected state even if disconnect fails
      }
    }
  }

  async send(params: { slot: number; data: string }): Promise<void> {
    const safeSlot = sanitizeSlot(params.slot);
    const s = this.ensure(safeSlot);
    if (!s.connection || s.status !== "connected") {
      throw new Error(
        `Slot ${safeSlot} no está conectado (estado=${s.status}).`,
      );
    }
    await s.connection.send(params.data);
  }
}

export const microbitSlotManager = new MicrobitSlotManager();
