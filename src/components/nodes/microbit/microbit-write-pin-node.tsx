import { memo, useCallback, useEffect, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { PenSquare } from "lucide-react";

import { MicrobitOutputShell } from "@/components/nodes/microbit/microbit-output-shell";
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

const MICROBIT_PIN_OPTIONS = [
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
type MicrobitPinName = (typeof MICROBIT_PIN_OPTIONS)[number];

type MicrobitPinMode = "digital" | "analog";

function sanitizePin(value: unknown): MicrobitPinName {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (MICROBIT_PIN_OPTIONS as readonly string[]).includes(raw)
    ? (raw as MicrobitPinName)
    : "P0";
}

function sanitizeMode(value: unknown): MicrobitPinMode {
  return value === "analog" ? "analog" : "digital";
}

export type MicrobitWritePinNodeData = {
  label?: string;
  runtimeError?: string | null;
  transport?: MicrobitTransport;
  microbitSlot?: number;
  pin?: MicrobitPinName;
  mode?: MicrobitPinMode;
};

export const MicrobitWritePinNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Escribir en pin",
    runtimeError,
    microbitSlot: rawMicrobitSlot,
    pin: rawPin,
    mode: rawMode,
  } = (data ?? {}) as MicrobitWritePinNodeData;

  const microbitSlot = sanitizeMicrobitSlot(rawMicrobitSlot);
  const pin = sanitizePin(rawPin);
  const mode = sanitizeMode(rawMode);

  const { setNodes } = useReactFlow();
  const connectedDevices = useConnectedMicrobitDevices();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const slotSelectId = useId();
  const pinSelectId = useId();
  const modeSelectId = useId();
  const [draftSlot, setDraftSlot] = useState<number | null>(null);
  const [draftPin, setDraftPin] = useState<MicrobitPinName>(pin);
  const [draftMode, setDraftMode] = useState<MicrobitPinMode>(mode);

  useEffect(() => {
    if (!isDialogOpen) return;

    setDraftPin(pin);
    setDraftMode(mode);

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
                pin: sanitizePin(draftPin),
                mode: draftMode,
              },
            }
          : node,
      ),
    );
    setIsDialogOpen(false);
  }, [canSave, connectedDevices, draftMode, draftPin, draftSlot, id, setNodes]);

  const subtitle = `${pin} · ${mode === "analog" ? "Analogico" : "Digital"}`;

  const iconComponent = (
    <div
      className="cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
      onClick={(e) => {
        e.stopPropagation();
        setIsDialogOpen(true);
      }}
    >
      <PenSquare />
    </div>
  );

  return (
    <>
      <MicrobitOutputShell
        nodeType="microbitWritePin"
        icon={iconComponent}
        label={label}
        subtitle={subtitle}
        runtimeError={runtimeError}
        onConfigClick={() => setIsDialogOpen(true)}
        targetHandleIds={["in-1"]}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar micro:bit · Escribir en pin</DialogTitle>
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
                    setDraftPin(sanitizePin(v));
                  }}
                >
                  <SelectTrigger id={pinSelectId}>
                    <SelectValue placeholder="Pin" />
                  </SelectTrigger>
                  <SelectContent>
                    {MICROBIT_PIN_OPTIONS.map((item) => (
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
                    setDraftMode(sanitizeMode(v));
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

            <p className="text-xs text-muted-foreground">
              El valor a escribir entra por el puerto izquierdo. En modo digital
              se interpreta como 0/1; en modo analogico se limita a 0..1023.
            </p>
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

MicrobitWritePinNode.displayName = "MicrobitWritePinNode";
