/// <reference types="@types/web-bluetooth" />

import * as microbit from "microbit-web-bluetooth";
import type { MessageHandler, MicrobitConnection } from "./types";

type UartServiceLike = {
  addEventListener: (
    type: "receiveText",
    listener: (event: { detail?: unknown }) => void,
  ) => void;
  sendText: (value: string) => Promise<void>;
};

export class BluetoothConnection implements MicrobitConnection {
  private device: BluetoothDevice | undefined = undefined;
  private uartService: UartServiceLike | null = null;
  private messageCallback: MessageHandler | null = null;
  private buffer: string = "";

  async connect(): Promise<void> {
    // Descubrir micro:bit
    this.device = await microbit.requestMicrobit(window.navigator.bluetooth);
    if (!this.device) {
      throw new Error("No se selecciono un micro:bit");
    }

    // Obtener servicios y UART
    const services = await microbit.getServices(this.device);
    const uartService = services.uartService as UartServiceLike | undefined;
    if (!uartService) {
      throw new Error("El servicio UART no esta disponible");
    }
    this.uartService = uartService;

    // Suscribirse a eventos UART
    uartService.addEventListener(
      "receiveText",
      (event: { detail?: unknown }) => {
        const text =
          typeof event.detail === "string"
            ? event.detail
            : String(event.detail ?? "");
        this.handleDataChunk(text);
      },
    );

    console.log("Conectado via Bluetooth (BLE)");
  }

  async send(data: string): Promise<void> {
    if (!this.uartService) throw new Error("No conectado");

    // microbit-web-bluetooth can truncate long writes unless we chunk them.
    // Our protocol is ASCII-only, so slicing by chars is safe.
    const full = data + "\n";
    const MAX_CHARS_PER_WRITE = 18;
    for (let i = 0; i < full.length; i += MAX_CHARS_PER_WRITE) {
      const chunk = full.slice(i, i + MAX_CHARS_PER_WRITE);
      await this.uartService.sendText(chunk);
      // Small yield to avoid overrunning the BLE UART buffer.
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    }
  }

  async disconnect(): Promise<void> {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.uartService = null;
  }

  onMessage(callback: MessageHandler): void {
    this.messageCallback = callback;
  }

  private handleDataChunk(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (this.messageCallback && line.trim()) {
        this.messageCallback(line.trim());
      }
    }
  }
}
