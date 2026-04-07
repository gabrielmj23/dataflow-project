/// <reference types="dom-serial" />
/// <reference types="web-bluetooth" />

import type { MicrobitConnection, MessageHandler } from "./types";
import { microbitSlotManager } from "./slot-manager";
import { sanitizeMicrobitSlot } from "./slot-utils";

export type MicrobitTransport = "serial" | "bluetooth";

const listeners = new Set<MessageHandler>();
const wiredConnections = new WeakSet<MicrobitConnection>();

function wireDispatch(slot: number, conn: MicrobitConnection) {
  if (wiredConnections.has(conn)) return;
  wiredConnections.add(conn);

  conn.onMessage((msg) => {
    console.log(msg);
    for (const listener of listeners) {
      try {
        listener(msg, { slot });
      } catch (err) {
        console.error("Microbit message listener error:", err);
      }
    }
  });
}

export function onMicrobitMessage(handler: MessageHandler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function getConnectedConnection(slot: number): MicrobitConnection | null {
  const connection = microbitSlotManager.getConnection(slot);
  if (connection) {
    wireDispatch(slot, connection);
  }
  return connection;
}

export function getMicrobitTransport(params?: {
  slot?: number;
}): MicrobitTransport | null {
  const slot = sanitizeMicrobitSlot(params?.slot);
  const snapshot = microbitSlotManager.getSnapshot(slot);
  if (snapshot.status !== "connected") return null;
  return snapshot.connectionType;
}

export function isMicrobitConnected(params?: { slot?: number }): boolean {
  const slot = sanitizeMicrobitSlot(params?.slot);
  return microbitSlotManager.getSnapshot(slot).status === "connected";
}

export async function connectMicrobit(params: {
  transport: MicrobitTransport;
  slot?: number;
}): Promise<void> {
  const slot = sanitizeMicrobitSlot(params.slot);
  await microbitSlotManager.connect({
    slot,
    connectionType: params.transport,
  });
  getConnectedConnection(slot);
}

export async function ensureMicrobitConnected(params: {
  transport: MicrobitTransport;
  slot?: number;
}): Promise<MicrobitConnection> {
  const slot = sanitizeMicrobitSlot(params.slot);
  const snapshot = microbitSlotManager.getSnapshot(slot);
  const connected = getConnectedConnection(slot);

  if (
    snapshot.status === "connected" &&
    snapshot.connectionType === params.transport &&
    connected
  ) {
    return connected;
  }

  if (
    snapshot.status === "connected" &&
    snapshot.connectionType !== params.transport
  ) {
    throw new Error(
      `La micro:bit del slot ${slot} está conectada por ${snapshot.connectionType}. Cambia el método de conexión o reconecta ese slot.`,
    );
  }

  throw new Error(
    `Slot ${slot} no conectado. Abre el diálogo "Conectar" del header y conecta la micro:bit en ese slot antes de ejecutar.`,
  );
}

export async function disconnectMicrobit(params?: {
  slot?: number;
}): Promise<void> {
  const slot = sanitizeMicrobitSlot(params?.slot);
  await microbitSlotManager.disconnect({ slot });
}
