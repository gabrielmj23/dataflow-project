import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Cpu } from "lucide-react";

import { MicrobitInputShell } from "@/components/nodes/microbit/microbit-input-shell";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { type MicrobitTransport } from "@/microbit/connection-manager";
import { sanitizeMicrobitSlot } from "@/microbit/slot-utils";
import { useConnectedMicrobitDevices } from "@/microbit/use-microbit-slot";
import { MicrobitConnectedSlotSelect } from "@/components/nodes/microbit/microbit-connected-slot-select";

const MICROBIT_DIGITAL_PIN_OPTIONS = [
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
  "P11",
  "P12",
  "P13",
  "P14",
  "P15",
  "P16",
] as const;
const MICROBIT_ANALOG_READ_PIN_OPTIONS = [
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "P10",
] as const;

type MicrobitPinName = (typeof MICROBIT_DIGITAL_PIN_OPTIONS)[number];

type MicrobitPinMode = "digital" | "analog";

function sanitizePin(value: unknown, mode: MicrobitPinMode): MicrobitPinName {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const allowedPins =
    mode === "analog"
      ? (MICROBIT_ANALOG_READ_PIN_OPTIONS as readonly string[])
      : (MICROBIT_DIGITAL_PIN_OPTIONS as readonly string[]);
  return allowedPins.includes(raw) ? (raw as MicrobitPinName) : "P0";
}

function sanitizeMode(value: unknown): MicrobitPinMode {
  return value === "analog" ? "analog" : "digital";
}

export type MicrobitReadPinNodeData = {
  label?: string;
  transport?: MicrobitTransport;
  microbitSlot?: number;
  pin?: MicrobitPinName;
  mode?: MicrobitPinMode;
};

export const MicrobitReadPinInputNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Leer pin",
    microbitSlot: rawMicrobitSlot,
    pin: rawPin,
    mode: rawMode,
  } = (data ?? {}) as MicrobitReadPinNodeData;

  const microbitSlot = sanitizeMicrobitSlot(rawMicrobitSlot);
  const mode = sanitizeMode(rawMode);
  const pin = sanitizePin(rawPin, mode);

  const { setNodes } = useReactFlow();
  const connectedDevices = useConnectedMicrobitDevices();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const slotSelectId = useId();
  const pinSelectId = useId();
  const modeSelectId = useId();
  const [draftSlot, setDraftSlot] = useState<number | null>(null);
  const [draftMode, setDraftMode] = useState<MicrobitPinMode>(mode);
  const [draftPin, setDraftPin] = useState<MicrobitPinName>(pin);

  useEffect(() => {
    if (!isDialogOpen) return;

    setDraftMode(mode);
    setDraftPin(pin);

    const isCurrentConnected = connectedDevices.some(
      (device) => device.slot === microbitSlot,
    );
    if (isCurrentConnected) {
      setDraftSlot(microbitSlot);
      return;
    }

    setDraftSlot(connectedDevices[0]?.slot ?? null);
  }, [connectedDevices, isDialogOpen, microbitSlot, mode, pin]);

  const canSave =
    draftSlot !== null &&
    connectedDevices.some((device) => device.slot === draftSlot);

  const onSave = useCallback(() => {
    if (!canSave || draftSlot === null) {
      return;
    }

    const selectedDevice = connectedDevices.find(
      (device) => device.slot === draftSlot,
    );
    if (!selectedDevice) {
      return;
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                microbitSlot: draftSlot,
                transport: selectedDevice.connectionType,
                mode: draftMode,
                pin: sanitizePin(draftPin, draftMode),
              },
            }
          : node,
      ),
    );
    setIsDialogOpen(false);
  }, [canSave, connectedDevices, draftMode, draftPin, draftSlot, id, setNodes]);

  const iconComponent = useMemo(() => {
    return (
      <div
        className="flex flex-col items-center leading-none cursor-pointer hover:scale-110 transition-transform"
        onClick={(e) => {
          e.stopPropagation();
          setIsDialogOpen(true);
        }}
      >
        <Cpu className="h-7 w-7" />
      </div>
    );
  }, []);

  return (
    <>
      <MicrobitInputShell
        nodeType="microbitReadPin"
        icon={iconComponent}
        label={label}
        onConfigClick={() => setIsDialogOpen(true)}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar micro:bit · Leer pin</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <MicrobitConnectedSlotSelect
              id={slotSelectId}
              selectedSlot={draftSlot}
              connectedDevices={connectedDevices}
              onSlotChange={(slot) => setDraftSlot(slot)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={pinSelectId}
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Pin
                </label>
                <Select
                  value={draftPin}
                  onValueChange={(v) => {
                    setDraftPin(sanitizePin(v, draftMode));
                  }}
                >
                  <SelectTrigger id={pinSelectId}>
                    <SelectValue placeholder="Pin" />
                  </SelectTrigger>
                  <SelectContent>
                    {(draftMode === "analog"
                      ? MICROBIT_ANALOG_READ_PIN_OPTIONS
                      : MICROBIT_DIGITAL_PIN_OPTIONS
                    ).map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor={modeSelectId}
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Modo
                </label>
                <Select
                  value={draftMode}
                  onValueChange={(v) => {
                    const nextMode = sanitizeMode(v);
                    setDraftMode(nextMode);
                    setDraftPin((prev) => sanitizePin(prev, nextMode));
                  }}
                >
                  <SelectTrigger id={modeSelectId}>
                    <SelectValue placeholder="Modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="analog">Analogico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={onSave} disabled={!canSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

MicrobitReadPinInputNode.displayName = "MicrobitReadPinInputNode";
