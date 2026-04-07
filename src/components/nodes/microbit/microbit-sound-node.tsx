import { memo, useCallback, useEffect, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Volume2 } from "lucide-react";

import { MicrobitOutputShell } from "@/components/nodes/microbit/microbit-output-shell";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MicrobitTransport } from "@/microbit/connection-manager";
import { sanitizeMicrobitSlot } from "@/microbit/slot-utils";
import { useConnectedMicrobitDevices } from "@/microbit/use-microbit-slot";
import { MicrobitConnectedSlotSelect } from "@/components/nodes/microbit/microbit-connected-slot-select";

export type MicrobitSoundNodeData = {
  label?: string;
  runtimeError?: string | null;
  transport?: MicrobitTransport;
  microbitSlot?: number;
};

export const MicrobitSoundNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Sonido",
    runtimeError,
    microbitSlot: rawMicrobitSlot,
  } = (data ?? {}) as MicrobitSoundNodeData;

  const microbitSlot = sanitizeMicrobitSlot(rawMicrobitSlot);

  const { setNodes } = useReactFlow();
  const connectedDevices = useConnectedMicrobitDevices();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const slotSelectId = useId();
  const [draftSlot, setDraftSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!isDialogOpen) return;

    const isCurrentConnected = connectedDevices.some(
      (device) => device.slot === microbitSlot,
    );
    if (isCurrentConnected) {
      setDraftSlot(microbitSlot);
      return;
    }

    setDraftSlot(connectedDevices[0]?.slot ?? null);
  }, [connectedDevices, isDialogOpen, microbitSlot]);

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
              },
            }
          : node,
      ),
    );
    setIsDialogOpen(false);
  }, [canSave, connectedDevices, draftSlot, id, setNodes]);

  const subtitle = connectedDevices.some(
    (device) => device.slot === microbitSlot,
  )
    ? "Conectado"
    : "No conectado";

  const iconComponent = (
    <div
      className="cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
      onClick={(e) => {
        e.stopPropagation();
        setIsDialogOpen(true);
      }}
    >
      <Volume2 />
    </div>
  );

  return (
    <>
      <MicrobitOutputShell
        nodeType="microbitSound"
        icon={iconComponent}
        label={label}
        subtitle={subtitle}
        runtimeError={runtimeError}
        onConfigClick={() => setIsDialogOpen(true)}
        targetHandleIds={["in-1", "in-2"]}
        targetHandleLabels={["Frecuencia (Hz)", "Duración (ms)"]}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar micro:bit · Sonido</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <MicrobitConnectedSlotSelect
              id={slotSelectId}
              selectedSlot={draftSlot}
              connectedDevices={connectedDevices}
              onSlotChange={(slot) => setDraftSlot(slot)}
            />
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

MicrobitSoundNode.displayName = "MicrobitSoundNode";
