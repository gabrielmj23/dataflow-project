/// <reference types="@types/web-bluetooth" />

import type { MessageHandler, MicrobitConnection } from "./types";

export class BluetoothConnection implements MicrobitConnection {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null; // Para leer
  private txChar: BluetoothRemoteGATTCharacteristic | null = null; // Para escribir
  private messageCallback: MessageHandler | null = null;
  private buffer: string = "";

  // UUIDs del servicio UART de Nordic (usado por micro:bit)
  private readonly UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  private readonly UART_TX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Escribir hacia micro:bit
  private readonly UART_RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Leer desde micro:bit

  /**
   * Establece la conexión de bluetooth con micro:bit
   */
  async connect(): Promise<void> {
    // Pre-checks para dar mensajes más útiles al usuario.
    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      throw new Error(
        "Web Bluetooth no está disponible en este navegador. Usa Chrome o Edge en HTTPS/localhost con Bluetooth habilitado."
      );
    }

    // Petición de dispositivo Bluetooth.
    // Usamos `acceptAllDevices: true` y `optionalServices` para aumentar
    // la probabilidad de encontrar micro:bit aunque su nombre no sea
    // exactamente "BBC micro:bit" en algunos firmwares.
    // Nota: el navegador mostrará un selector donde el usuario debe elegir
    // el micro:bit. Web Bluetooth requiere gesto de usuario para abrirlo.
    try {
      // Preferimos filtrar por nombre/servicio para que el chooser muestre solo
      // candidatos micro:bit. Usamos namePrefix y el UUID UART como filtros.
      // Esto reduce el ruido de otros periféricos Bluetooth.
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "BBC micro:bit" },
          { services: [this.UART_SERVICE_UUID] },
        ],
        optionalServices: [this.UART_SERVICE_UUID],
      });
    } catch (err: any) {
      // Si no se encontraron dispositivos con estos filtros, el navegador
      // lanzará NotFoundError. Proporcionamos un mensaje con indicaciones.
      const name = err instanceof Error ? err.name : String(err);
      console.error("BluetoothConnection.requestDevice ->", err);
      if (name === "NotFoundError") {
        throw new Error(
          "No se encontraron micro:bit en el selector. Asegúrate de que el micro:bit esté encendido, con Bluetooth activo y exponga el servicio UART. Si tu micro:bit tiene un nombre distinto, prueba a usar la opción de descubrimiento amplio en ajustes."
        );
      }
      const message = `No se pudo abrir el selector Bluetooth: ${name}`;
      throw new Error(message);
    }

    // Conectar al servidor GATT
    try {
      if (!this.device.gatt) {
        throw new Error("GATT no disponible (device.gatt es nulo). Comprueba compatibilidad BLE y permisos del navegador.");
      }

      this.server = await this.device.gatt.connect();

      // Intenta obtener el servicio UART; si no está presente lanzaremos un error claro
      const service = await this.server.getPrimaryService(this.UART_SERVICE_UUID);

      // Obtener características de lectura y escritura
      this.txChar = await service.getCharacteristic(this.UART_TX_UUID);
      this.rxChar = await service.getCharacteristic(this.UART_RX_UUID);

      // Suscribirse a notificaciones (Eventos Push)
      await this.rxChar.startNotifications();
      this.rxChar.addEventListener(
        "characteristicvaluechanged",
        (event: Event) => {
          const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
          const decoder = new TextDecoder();
          const text = decoder.decode(value);
          this.handleDataChunk(text);
        }
      );
    } catch (err) {
      // Re-lanzamos un error con más contexto para el usuario
      const deviceLabel = this.device ? (this.device.name || this.device.id) : "(desconocido)";
      const baseMessage = err instanceof Error ? err.message : String(err);
      const message = `GATT Error conectando a ${deviceLabel}: ${baseMessage}`;
      console.error("BluetoothConnection.connect ->", message, err);
      throw new Error(message);
    }
  }

  /**
   * Enviar datos a la micro:bit
   * @param data
   */
  async send(data: string): Promise<void> {
    if (!this.txChar) throw new Error("No conectado");
    const encoder = new TextEncoder();
    // Añadimos \n al final
    await this.txChar.writeValue(encoder.encode(data + "\n"));
  }

  /**
   * Desconectar de la micro:bit
   */
  async disconnect(): Promise<void> {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
  }

  getDeviceLabel(): string | undefined {
    return this.device ? (this.device.name || this.device.id) : undefined;
  }

  /**
   * Registra un callback para recibir mensajes del micro:bit
   * @param callback
   */
  onMessage(callback: MessageHandler): void {
    this.messageCallback = callback;
  }

  /**
   * Maneja fragmentos de datos recibidos y reconstruye mensajes completos
   * @param chunk
   */
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
