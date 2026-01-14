/// <reference types="dom-serial" />
/// <reference types="web-bluetooth" />

import type { MicrobitConnection, MessageHandler } from "./types";

import { BluetoothConnection } from "./bluetooth-connector";
import { SerialConnection } from "./serial-connector";

export type MicrobitTransport = "serial" | "bluetooth";

type ConnectionState = {
  transport: MicrobitTransport;
  connection: MicrobitConnection;
};

let state: ConnectionState | null = null;

const listeners = new Set<MessageHandler>();

function wireDispatch(conn: MicrobitConnection) {
  conn.onMessage((msg) => {
    console.log(msg);
    for (const listener of listeners) {
      try {
        listener(msg);
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

export function getMicrobitTransport(): MicrobitTransport | null {
  return state?.transport ?? null;
}

export function isMicrobitConnected(): boolean {
  // We don't have a reliable cross-transport "connected" flag.
  // If we have state, we consider it connected.
  return state != null;
}

export async function connectMicrobit(params: {
  transport: MicrobitTransport;
}): Promise<void> {
  // This should be called from a user gesture (button click), because it may
  // open the Chrome device picker (Web Serial / Web Bluetooth).
  await disconnectMicrobit();

  if (params.transport === "serial") {
    const conn = new SerialConnection();
    wireDispatch(conn);
    await conn.connect();
    state = { transport: "serial", connection: conn };
    return;
  }

  const conn = new BluetoothConnection();
  wireDispatch(conn);
  await conn.connect();
  // NOTE: we can't persist the device across reloads; keep only in-memory.
  state = { transport: "bluetooth", connection: conn };
}

export async function ensureMicrobitConnected(params: {
  transport: MicrobitTransport;
}): Promise<MicrobitConnection> {
  if (state && state.transport === params.transport) {
    return state.connection;
  }

  // Try to reconnect without prompting when possible.
  if (params.transport === "serial") {
    // If the user already granted permission, Chrome can return ports here.
    const ports = await navigator.serial.getPorts();
    const port = ports[0];
    if (!port) {
      throw new Error(
        "No hay un puerto serial autorizado. Abre la configuración del nodo y selecciona el puerto de la micro:bit."
      );
    }

    const conn = new SerialConnection(port);
    wireDispatch(conn);
    await conn.connect();
    state = { transport: "serial", connection: conn };
    return conn;
  }

  // Web Bluetooth cannot reliably reconnect without a previously obtained
  // BluetoothDevice reference. Require the user to connect via the config dialog.
  throw new Error(
    "Micro:bit por Bluetooth requiere autorización. Abre la configuración del nodo y conecta por Bluetooth antes de ejecutar."
  );
}

export async function disconnectMicrobit(): Promise<void> {
  if (!state) return;
  try {
    await state.connection.disconnect();
  } finally {
    state = null;
  }
}
