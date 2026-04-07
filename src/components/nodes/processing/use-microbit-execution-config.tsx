import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReactFlow } from "@xyflow/react";

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
import { useRemoteControllers } from "@/ws/remote-controllers-context";

type ExecutionTarget = "local" | "microbit" | "controller";

type UseMicrobitExecutionConfigParams = {
  nodeId: string;
  title: string;
  executionTarget?: unknown;
  transport?: unknown;
  microbitSlot?: unknown;
  controllerId?: unknown;
  controllerName?: unknown;
};

type UseMicrobitExecutionConfigResult = {
  subtitle: string;
  onConfigClick: () => void;
  dialog: ReactNode;
  executionTarget: ExecutionTarget;
  transport: MicrobitTransport;
  controllerId?: string;
  controllerName?: string;
};

export function useMicrobitExecutionConfig(
  params: UseMicrobitExecutionConfigParams,
): UseMicrobitExecutionConfigResult {
  const { setNodes, getNode } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controllers = useRemoteControllers();
  const connectedMicrobits = useConnectedMicrobitDevices();

  const executionTarget: ExecutionTarget =
    params.executionTarget === "microbit" ||
    params.executionTarget === "controller"
      ? params.executionTarget
      : "local";

  const transport: MicrobitTransport =
    params.transport === "bluetooth" || params.transport === "serial"
      ? params.transport
      : "serial";
  const fallbackNodeData = (getNode(params.nodeId)?.data ?? {}) as Record<
    string,
    unknown
  >;
  const microbitSlot = sanitizeMicrobitSlot(
    params.microbitSlot ??
      fallbackNodeData.microbitSlot ??
      fallbackNodeData.slot,
  );

  const controllerId =
    typeof params.controllerId === "string" ? params.controllerId : "";
  const controllerName =
    typeof params.controllerName === "string" ? params.controllerName : "";

  const targetSelectId = useId();
  const slotSelectId = useId();
  const [draftExecutionTarget, setDraftExecutionTarget] =
    useState<ExecutionTarget>(executionTarget);
  const [draftControllerId, setDraftControllerId] =
    useState<string>(controllerId);
  const [draftMicrobitSlot, setDraftMicrobitSlot] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrorMessage(null);
    setDraftExecutionTarget(executionTarget);
    setDraftControllerId(controllerId);

    const isCurrentConnected = connectedMicrobits.some(
      (device) => device.slot === microbitSlot,
    );
    if (isCurrentConnected) {
      setDraftMicrobitSlot(microbitSlot);
      return;
    }

    setDraftMicrobitSlot(connectedMicrobits[0]?.slot ?? null);
  }, [
    connectedMicrobits,
    controllerId,
    executionTarget,
    isDialogOpen,
    microbitSlot,
  ]);

  const canSave = useMemo(() => {
    if (draftExecutionTarget === "controller") {
      return !!draftControllerId;
    }
    if (draftExecutionTarget === "microbit") {
      if (draftMicrobitSlot === null) return false;
      return connectedMicrobits.some(
        (device) => device.slot === draftMicrobitSlot,
      );
    }
    return true;
  }, [
    connectedMicrobits,
    draftControllerId,
    draftExecutionTarget,
    draftMicrobitSlot,
  ]);

  const save = useCallback(() => {
    if (!canSave) {
      setErrorMessage("Completa la configuración antes de guardar.");
      return;
    }

    const patch: Record<string, unknown> = {
      executionTarget: draftExecutionTarget,
    };

    if (draftExecutionTarget === "controller") {
      const selectedController = controllers.find(
        (item) => item.id === draftControllerId,
      );
      patch.controllerId = draftControllerId || undefined;
      patch.controllerName = selectedController?.name ?? undefined;
    } else {
      patch.controllerId = undefined;
      patch.controllerName = undefined;
    }

    if (draftExecutionTarget === "microbit") {
      const selectedMicrobit = connectedMicrobits.find(
        (item) => item.slot === draftMicrobitSlot,
      );
      if (!selectedMicrobit || draftMicrobitSlot === null) {
        setErrorMessage(
          "La micro:bit seleccionada no está conectada. Presiona 'Conectar' arriba a la derecha y vuelve a intentar.",
        );
        return;
      }
      patch.microbitSlot = draftMicrobitSlot;
      patch.transport = selectedMicrobit.connectionType;
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.id === params.nodeId
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                ...patch,
              },
            }
          : node,
      ),
    );

    setIsDialogOpen(false);
  }, [
    canSave,
    connectedMicrobits,
    controllers,
    draftControllerId,
    draftExecutionTarget,
    draftMicrobitSlot,
    params.nodeId,
    setNodes,
  ]);

  const subtitle =
    executionTarget === "microbit"
      ? connectedMicrobits.some((device) => device.slot === microbitSlot)
        ? `micro:bit #${microbitSlot}`
        : `micro:bit #${microbitSlot} (no conectada)`
      : executionTarget === "controller"
        ? `${
            (controllers.find((c) => c.id === controllerId)?.name ??
              controllerName) ||
            (controllerId ? `ID ${controllerId}` : "Sin seleccionar")
          }`
        : "";

  const dialog = (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{params.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor={targetSelectId}
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              Ejecutar en
            </label>
            <Select
              value={draftExecutionTarget}
              onValueChange={(value) => {
                if (
                  value === "local" ||
                  value === "microbit" ||
                  value === "controller"
                ) {
                  setDraftExecutionTarget(value);
                }
              }}
            >
              <SelectTrigger id={targetSelectId}>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Esta PC</SelectItem>
                <SelectItem value="microbit">micro:bit</SelectItem>
                <SelectItem value="controller">Otra PC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draftExecutionTarget === "controller" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                PC remota
              </label>
              <Select
                value={draftControllerId || undefined}
                onValueChange={(value) => {
                  if (value === "__none__") return;
                  setDraftControllerId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una PC" />
                </SelectTrigger>
                <SelectContent>
                  {controllers.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      (Sin PCs conectadas)
                    </SelectItem>
                  ) : (
                    controllers.map((controller) => (
                      <SelectItem key={controller.id} value={controller.id}>
                        {controller.name ?? controller.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Debe haber una PC conectada en la misma sesión.
              </p>
            </div>
          )}

          {draftExecutionTarget === "microbit" && (
            <>
              <MicrobitConnectedSlotSelect
                id={slotSelectId}
                selectedSlot={draftMicrobitSlot}
                connectedDevices={connectedMicrobits}
                onSlotChange={(slot) => setDraftMicrobitSlot(slot)}
              />
            </>
          )}

          {errorMessage && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsDialogOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={!canSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    executionTarget,
    transport,
    controllerId: controllerId || undefined,
    controllerName: controllerName || undefined,
    subtitle,
    onConfigClick: () => setIsDialogOpen(true),
    dialog,
  };
}
