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
  status: MicrobitSlotStatus;
  connectionType: MicrobitConnectionType;
  deviceLabel?: string;
  lastError?: string;
};

type InternalSlotState = MicrobitSlotState & {
  connection: MicrobitConnection | null;
  connectToken: number;
  snapshot: MicrobitSlotState;
};

function sanitizeSlot(slot: number): number {
  const safe = Number.isFinite(slot) ? Math.floor(slot) : 1;
  return Math.min(8, Math.max(1, safe));
}

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

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private ensure(slot: number): InternalSlotState {
    const safeSlot = sanitizeSlot(slot);
    const existing = this.slots.get(safeSlot);
    if (existing) return existing;

    const next: InternalSlotState = {
      slot: safeSlot,
      status: "disconnected",
      connectionType: "bluetooth",
      connection: null,
      connectToken: 0,
      snapshot: {
        slot: safeSlot,
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
    if (s.status === "connected" && s.connection && s.connectionType === params.connectionType) {
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
      latest.lastError = undefined;
      // Best-effort: ask the connection for a human-readable label
      try {
        const label = (connection as any).getDeviceLabel ? (connection as any).getDeviceLabel() : undefined;
        latest.deviceLabel = label ?? (params.connectionType === "bluetooth" ? "Bluetooth" : "Serial");
      } catch {
        latest.deviceLabel = params.connectionType === "bluetooth" ? "Bluetooth" : "Serial";
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
        `Slot ${safeSlot} no está conectado (estado=${s.status}).`
      );
    }
    await s.connection.send(params.data);
  }
}

export const microbitSlotManager = new MicrobitSlotManager();
