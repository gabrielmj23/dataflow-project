import { memo, useCallback, useEffect, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Thermometer } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
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

export type MicrobitReadTemperaturePulseNodeData = {
  label?: string;
  transport?: MicrobitTransport;
  microbitSlot?: number;
};

export const MicrobitReadTemperaturePulseInputNode = memo(
  ({ id, data }: NodeProps) => {
    const { label = "Temperatura pulsos", microbitSlot: rawMicrobitSlot } =
      (data ?? {}) as MicrobitReadTemperaturePulseNodeData;

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

    return (
      <>
        <IterationRectNodeShell
          nodeType="microbitReadTemperaturePulse"
          icon={<Thermometer className="h-4 w-4" />}
          label={label}
          variant="doubleInSingleOut"
          className="relative flex h-18 w-36 flex-col justify-center rounded-2xl border-sky-700 bg-sky-600 px-6 text-center text-white shadow-md"
          indicatorClassName="border-sky-700"
          onConfigClick={() => setIsDialogOpen(true)}
        />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Configurar micro:bit · Temperatura pulsos
              </DialogTitle>
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
  },
);

MicrobitReadTemperaturePulseInputNode.displayName =
  "MicrobitReadTemperaturePulseInputNode";
