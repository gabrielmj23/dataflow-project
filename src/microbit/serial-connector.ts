/// <reference types="dom-serial" />

import type { MessageHandler, MicrobitConnection } from "./types";

export class SerialConnection implements MicrobitConnection {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private messageCallback: MessageHandler | null = null;

  // Buffer para reconstruir mensajes fragmentados
  private buffer: string = "";

  constructor(existingPort?: SerialPort) {
    this.port = existingPort ?? null;
  }

  /**
   * Establece la conexión serial con el micro:bit
   */
  async connect(): Promise<void> {
    // Pide al usuario seleccionar el puerto (solo si no hay uno provisto)
    if (!this.port) {
      this.port = await navigator.serial.requestPort();
    }

    if (this.port.readable || this.port.writable) {
      try {
        await this.port.close();
      } catch {
        // Ignore and let open() surface a meaningful error if it still fails.
      }
    }

    // Abre la conexión
    await this.port.open({ baudRate: 115200 });

    // Configura lector y escritor
    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(this.port.writable);
    this.writer = textEncoder.writable.getWriter();

    // Inicia el bucle de lectura (Listener)
    this.startReading();
  }

  /**
   * Envía datos al micro:bit
   * @param data
   */
  async send(data: string): Promise<void> {
    if (!this.writer) throw new Error("No conectado");
    // Añadimos \n para indicar fin de mensaje
    await this.writer.write(data + "\n");
  }

  /**
   * Cierra la conexión serial
   */
  async disconnect(): Promise<void> {
    const reader = this.reader;
    const writer = this.writer;
    const port = this.port;

    this.reader = null;
    this.writer = null;
    this.port = null;

    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Ignore reader cancellation errors during teardown.
      }
      try {
        reader.releaseLock();
      } catch {
        // Ignore lock release errors during teardown.
      }
    }

    if (writer) {
      try {
        await writer.close();
      } catch {
        // Ignore writer closing errors during teardown.
      }
      try {
        writer.releaseLock();
      } catch {
        // Ignore lock release errors during teardown.
      }
    }

    if (port) {
      try {
        await port.close();
      } catch {
        // Keep best-effort semantics: slot-manager already transitions state.
      }
    }

    this.buffer = "";
  }

  /**
   * Registra un callback para recibir mensajes del micro:bit
   * @param callback
   */
  onMessage(callback: MessageHandler): void {
    this.messageCallback = callback;
  }

  getDeviceLabel(): string | undefined {
    try {
      // Intentamos obtener información del puerto si está disponible
      const info = this.port?.getInfo ? this.port.getInfo() : undefined;
      if (info && (info.usbVendorId || info.usbProductId)) {
        const vid = info.usbVendorId ? info.usbVendorId.toString(16) : "";
        const pid = info.usbProductId ? info.usbProductId.toString(16) : "";
        return `Serial ${vid}:${pid}`;
      }
    } catch {
      // ignore
    }
    return this.port ? "Serial" : undefined;
  }

  /**
   * Lógica para leer el flujo de datos continuo
   */
  private async startReading() {
    const textDecoder = new TextDecoderStream();
    this.port!.readable.pipeTo(textDecoder.writable).catch(() => {
      // disconnect() may cancel the stream; this is expected.
    });
    this.reader = textDecoder.readable.getReader();

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.handleDataChunk(value);
      }
    } catch (error) {
      console.error("Error leyendo serial:", error);
    }
  }

  /**
   * Reconstruye fragmentos: "M1:10" + "0\n" -> "M1:100"
   * @param chunk
   */
  private handleDataChunk(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");

    // La última parte puede estar incompleta, la guardamos en el buffer
    this.buffer = lines.pop() || "";

    // Procesamos las líneas completas
    lines.forEach((line) => {
      if (this.messageCallback && line.trim()) {
        this.messageCallback(line.trim());
      }
    });
  }
}
