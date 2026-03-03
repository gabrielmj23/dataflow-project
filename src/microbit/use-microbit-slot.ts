import { useSyncExternalStore } from "react";

import {
  microbitSlotManager,
  type MicrobitConnectionType,
  type MicrobitSlotState,
} from "@/microbit/slot-manager";

export function useMicrobitSlot(slot: number): MicrobitSlotState {
  return useSyncExternalStore(
    (listener) => microbitSlotManager.subscribe(listener),
    () => microbitSlotManager.getSnapshot(slot),
    () => microbitSlotManager.getSnapshot(slot),
  );
}

export function useConnectedMicrobitDevices(): MicrobitSlotState[] {
  return useSyncExternalStore(
    (listener) => microbitSlotManager.subscribe(listener),
    () => microbitSlotManager.getConnectedSnapshots(),
    () => microbitSlotManager.getConnectedSnapshots(),
  );
}

export async function connectMicrobitSlot(params: {
  slot: number;
  connectionType: MicrobitConnectionType;
}): Promise<void> {
  return microbitSlotManager.connect(params);
}

export async function disconnectMicrobitSlot(params: {
  slot: number;
}): Promise<void> {
  return microbitSlotManager.disconnect(params);
}

export async function sendMicrobitSlot(params: {
  slot: number;
  data: string;
}): Promise<void> {
  return microbitSlotManager.send(params);
}
