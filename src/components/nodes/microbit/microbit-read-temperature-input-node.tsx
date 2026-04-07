import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Thermometer } from "lucide-react";

import { MicrobitInputShell } from "@/components/nodes/microbit/microbit-input-shell";
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

export type MicrobitReadTemperatureNodeData = {
  label?: string;
  transport?: MicrobitTransport;
  microbitSlot?: number;
};

export const MicrobitReadTemperatureInputNode = memo(
  ({ id, data }: NodeProps) => {
    const { label = "Temperatura" } = (data ??
      {}) as MicrobitReadTemperatureNodeData;

    const rawMicrobitSlot = (data as MicrobitReadTemperatureNodeData | null)
      ?.microbitSlot;

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

    const iconComponent = useMemo(() => {
      return (
        <div
          className="flex flex-col items-center leading-none cursor-pointer hover:scale-110 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            setIsDialogOpen(true);
          }}
        >
          <Thermometer className="h-7 w-7" />
        </div>
      );
    }, []);

    return (
      <>
        <MicrobitInputShell
          nodeType="microbitReadTemperature"
          icon={iconComponent}
          label={label}
          onConfigClick={() => setIsDialogOpen(true)}
        />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar micro:bit · Temperatura</DialogTitle>
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

MicrobitReadTemperatureInputNode.displayName =
  "MicrobitReadTemperatureInputNode";
