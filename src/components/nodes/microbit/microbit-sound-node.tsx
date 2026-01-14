import { memo, useCallback, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReactFlow } from "@xyflow/react";
import {
  connectMicrobitSlot,
  disconnectMicrobitSlot,
  useMicrobitSlot,
} from "@/microbit/use-microbit-slot";

export type MicrobitSoundNodeData = {
  label?: string;
  runtimeError?: string | null;
  microbitSlot?: number; // 1..N
  connectionType?: "bluetooth" | "serial";
};

function sanitizeSlot(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(8, Math.max(1, Math.floor(n)));
}

export const MicrobitSoundNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "micro:bit · Sonido",
    runtimeError,
    microbitSlot: rawSlot,
    connectionType: rawConn,
  } = (data ?? {}) as MicrobitSoundNodeData;

  const microbitSlot = useMemo(() => sanitizeSlot(rawSlot), [rawSlot]);
  const connectionType = rawConn === "serial" ? "serial" : "bluetooth";

  const slotState = useMicrobitSlot(microbitSlot);

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = useCallback(() => setIsDialogOpen(true), []);
  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  const [draftSlot, setDraftSlot] = useState<number>(microbitSlot);
  const [draftConn, setDraftConn] = useState<"bluetooth" | "serial">(
    connectionType
  );

  const draftSlotState = useMicrobitSlot(draftSlot);

  const resetDraftFromNode = useCallback(() => {
    setDraftSlot(microbitSlot);
    setDraftConn(connectionType);
  }, [microbitSlot, connectionType]);

  const saveConfig = useCallback(() => {
    setNodes((prev) =>
      prev.map((n) =>
        String(n.id) === String(id)
          ? {
              ...n,
              data: {
                ...(n.data && typeof n.data === "object"
                  ? (n.data as Record<string, unknown>)
                  : {}),
                microbitSlot: draftSlot,
                connectionType: draftConn,
              },
            }
          : n
      )
    );
    setIsDialogOpen(false);
  }, [draftConn, draftSlot, id, setNodes]);

  return (
    <>
      <MicrobitOutputShell
        nodeType="microbitSound"
        icon={<Volume2 />}
        label={label}
        subtitle={`${connectionType === "bluetooth" ? "Bluetooth" : "Serial"} · micro:bit ${microbitSlot} · ${slotState.status}`}
        runtimeError={runtimeError}
        onConfigClick={() => {
          resetDraftFromNode();
          openDialog();
        }}
        targetHandleIds={["in-1"]}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuración · micro:bit</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-md border p-3">
              <div className="text-sm font-medium">Estado de conexión</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Slot {draftSlot}: {draftSlotState.status}
                {draftSlotState.status === "connected" &&
                  ` (${draftSlotState.connectionType})`}
              </div>
              {draftSlotState.lastError && (
                <div className="mt-2 text-sm text-red-600">
                  {draftSlotState.lastError}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      await connectMicrobitSlot({
                        slot: draftSlot,
                        connectionType: draftConn,
                      });
                    } catch {
                      // Error is surfaced via manager state.
                    }
                  }}
                  disabled={
                    draftSlotState.status === "connecting" ||
                    (draftSlotState.status === "connected" &&
                      draftSlotState.connectionType === draftConn)
                  }
                >
                  {draftSlotState.status === "connecting"
                    ? "Conectando…"
                    : "Conectar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await disconnectMicrobitSlot({ slot: draftSlot });
                  }}
                  disabled={draftSlotState.status !== "connected"}
                >
                  Desconectar
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Nota: el navegador pedirá permisos al conectar.
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Conexión
              </label>
              <Select
                value={draftConn}
                onValueChange={(value: string) => {
                  if (value === "bluetooth" || value === "serial") {
                    setDraftConn(value);
                  }
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecciona una conexión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  <SelectItem value="serial">Serial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                micro:bit
              </label>
              <Select
                value={String(draftSlot)}
                onValueChange={(value: string) => {
                  setDraftSlot(sanitizeSlot(value));
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecciona un micro:bit" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 4 }, (_, i) => i + 1).map((slot) => (
                    <SelectItem key={slot} value={String(slot)}>
                      micro:bit {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              Esta configuración solo guarda la selección. La conexión real y la
              ejecución del sonido se implementarán después.
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                closeDialog();
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={saveConfig}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

MicrobitSoundNode.displayName = "MicrobitSoundNode";
