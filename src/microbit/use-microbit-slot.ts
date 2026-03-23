import { useSyncExternalStore } from "react";

import {
  microbitSlotManager,
  type MicrobitConnectionType,
  type MicrobitKnownSlot,
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

export function useKnownMicrobitSlots(): MicrobitKnownSlot[] {
  return useSyncExternalStore(
    (listener) => microbitSlotManager.subscribe(listener),
    () => microbitSlotManager.getKnownSlots(),
    () => microbitSlotManager.getKnownSlots(),
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

export function setMicrobitSlotName(params: {
  slot: number;
  name?: string;
}): void {
  microbitSlotManager.setSlotName(params);
}

export function getMicrobitSlotName(slot: number): string | undefined {
  return microbitSlotManager.getSlotName(slot);
}
