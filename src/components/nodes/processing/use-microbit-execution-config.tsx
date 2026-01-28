import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { useReactFlow } from "@xyflow/react";

import {
  Dialog,
  DialogContent,
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
import {
  connectMicrobit,
  disconnectMicrobit,
  getMicrobitTransport,
  isMicrobitConnected,
  type MicrobitTransport,
} from "@/microbit/connection-manager";
import { useRemoteControllers } from "@/ws/remote-controllers-context";

type ExecutionTarget = "local" | "microbit" | "controller";

type UseMicrobitExecutionConfigParams = {
  nodeId: string;
  title: string;
  executionTarget?: unknown;
  transport?: unknown;
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
  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controllers = useRemoteControllers();

  const executionTarget: ExecutionTarget =
    params.executionTarget === "microbit" ||
    params.executionTarget === "controller"
      ? params.executionTarget
      : "local";

  const transport: MicrobitTransport =
    params.transport === "bluetooth" || params.transport === "serial"
      ? params.transport
      : "serial";

  const controllerId =
    typeof params.controllerId === "string" ? params.controllerId : "";
  const controllerName =
    typeof params.controllerName === "string" ? params.controllerName : "";

  const targetSelectId = useId();
  const transportSelectId = useId();

  const setExecutionTarget = useCallback(
    (nextTarget: ExecutionTarget) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === params.nodeId
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  executionTarget: nextTarget,
                },
              }
            : node,
        ),
      );
    },
    [params.nodeId, setNodes],
  );

  const setTransport = useCallback(
    (nextTransport: MicrobitTransport) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === params.nodeId
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  transport: nextTransport,
                },
              }
            : node,
        ),
      );
    },
    [params.nodeId, setNodes],
  );

  const setControllerId = useCallback(
    (nextControllerId: string) => {
      const nextName = controllers.find(
        (item) => item.id === nextControllerId,
      )?.name;
      setNodes((prev) =>
        prev.map((node) =>
          node.id === params.nodeId
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  controllerId: nextControllerId || undefined,
                  controllerName: nextControllerId
                    ? nextName || undefined
                    : undefined,
                },
              }
            : node,
        ),
      );
    },
    [controllers, params.nodeId, setNodes],
  );

  useEffect(() => {
    if (executionTarget !== "controller") return;
    if (!controllerId || !controllerName) return;
    const hasId = controllers.some((item) => item.id === controllerId);
    if (hasId) return;
    const match = controllers.find((item) => item.name === controllerName);
    if (!match || match.id === controllerId) return;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === params.nodeId
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                controllerId: match.id,
                controllerName: match.name ?? controllerName,
              },
            }
          : node,
      ),
    );
  }, [
    controllers,
    controllerId,
    controllerName,
    executionTarget,
    params.nodeId,
    setNodes,
  ]);

  const connectedInfo = (() => {
    if (!isMicrobitConnected()) return { ok: false as const, text: "" };
    const t = getMicrobitTransport();
    return {
      ok: true as const,
      text:
        t === "bluetooth"
          ? "Conectado por Bluetooth"
          : t === "serial"
            ? "Conectado por cable (Serial)"
            : "Conectado",
    };
  })();

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      await connectMicrobit({ transport });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [transport]);

  const disconnect = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      await disconnectMicrobit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const subtitle =
    executionTarget === "microbit"
      ? `micro:bit · ${connectedInfo.ok ? "Conectado" : "No conectado"}`
      : executionTarget === "controller"
        ? `Otra PC · ${
            (controllers.find((c) => c.id === controllerId)?.name ??
              controllerName) ||
            (controllerId ? `ID ${controllerId}` : "Sin seleccionar")
          }`
        : "Local";

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
              value={executionTarget}
              onValueChange={(value) => {
                if (
                  value === "local" ||
                  value === "microbit" ||
                  value === "controller"
                ) {
                  setExecutionTarget(value);
                }
              }}
            >
              <SelectTrigger id={targetSelectId}>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="microbit">micro:bit</SelectItem>
                <SelectItem value="controller">Otra PC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {executionTarget === "controller" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Controller remoto
              </label>
              <Select
                value={controllerId || undefined}
                onValueChange={(value) => {
                  if (value === "__none__") return;
                  setControllerId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un controller" />
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

          {executionTarget === "microbit" && (
            <>
              <div>
                <label
                  htmlFor={transportSelectId}
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Método de conexión
                </label>
                <Select
                  value={transport}
                  onValueChange={(value) => {
                    if (value === "serial" || value === "bluetooth") {
                      setTransport(value);
                    }
                  }}
                >
                  <SelectTrigger id={transportSelectId}>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serial">Cable (Web Serial)</SelectItem>
                    <SelectItem value="bluetooth">
                      Bluetooth (Web Bluetooth)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nota: Para que aparezca el selector de dispositivo, usa Chrome
                  o Edge y ejecuta la app en localhost/https.
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Instrucciones rápidas</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                  <li>
                    Conecta/enciende la micro:bit y prepara el programa que
                    procesa comandos.
                  </li>
                  <li>
                    Presiona <span className="font-semibold">Conectar</span>. Se
                    abrirá una ventana pequeña de Chrome para seleccionar el
                    dispositivo.
                  </li>
                  <li>
                    Luego, al ejecutar el flujo, este nodo enviará la operación
                    a la micro:bit y esperará el resultado.
                  </li>
                </ol>
              </div>

              {errorMessage && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {connectedInfo.ok ? connectedInfo.text : "No conectado"}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isConnecting}
                    onClick={disconnect}
                  >
                    Desconectar
                  </Button>
                  <Button
                    type="button"
                    disabled={isConnecting}
                    onClick={connect}
                  >
                    {isConnecting ? "Conectando…" : "Conectar"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
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
