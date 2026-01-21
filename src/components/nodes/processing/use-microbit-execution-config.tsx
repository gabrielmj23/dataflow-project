import { useCallback, useId, useState, type ReactNode } from "react";
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

type ExecutionTarget = "local" | "microbit";

type UseMicrobitExecutionConfigParams = {
  nodeId: string;
  title: string;
  executionTarget?: unknown;
  transport?: unknown;
};

type UseMicrobitExecutionConfigResult = {
  subtitle: string;
  onConfigClick: () => void;
  dialog: ReactNode;
  executionTarget: ExecutionTarget;
  transport: MicrobitTransport;
};

export function useMicrobitExecutionConfig(
  params: UseMicrobitExecutionConfigParams,
): UseMicrobitExecutionConfigResult {
  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executionTarget: ExecutionTarget =
    params.executionTarget === "microbit" ? "microbit" : "local";

  const transport: MicrobitTransport =
    params.transport === "bluetooth" || params.transport === "serial"
      ? params.transport
      : "serial";

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
      ? `micro:bit · ${transport === "bluetooth" ? "Bluetooth" : "Serial"} · ${connectedInfo.ok ? "Conectado" : "No conectado"}`
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
                if (value === "local" || value === "microbit") {
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
              </SelectContent>
            </Select>
          </div>

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
                    Presiona <span className="font-semibold">Conectar</span>.
                    Se abrirá una ventana pequeña de Chrome para seleccionar el
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
    subtitle,
    onConfigClick: () => setIsDialogOpen(true),
    dialog,
    executionTarget,
    transport,
  };
}
