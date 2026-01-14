export type MessageHandler = (message: string) => void;

export interface MicrobitConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: string): Promise<void>;
  onMessage(callback: MessageHandler): void;
  /**
   * Optional human-readable label for the connected device (e.g. Bluetooth name).
   */
  getDeviceLabel?(): string | undefined;
}
