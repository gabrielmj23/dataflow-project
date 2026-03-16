import { memo, useCallback, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { MessageSquareText } from "lucide-react";

import { MicrobitOutputShell } from "@/components/nodes/microbit/microbit-output-shell";
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

export type MicrobitWriteNodeData = {
  label?: string;
  runtimeError?: string | null;
  transport?: MicrobitTransport;
};

export const MicrobitWriteNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "micro:bit · Escribir",
    runtimeError,
    transport: rawTransport,
  } = (data ?? {}) as MicrobitWriteNodeData;

  const transport: MicrobitTransport =
    rawTransport === "bluetooth" || rawTransport === "serial"
      ? rawTransport
      : "serial";

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectId = useId();

  const setTransport = useCallback(
    (nextTransport: MicrobitTransport) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
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
    [id, setNodes],
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

  const subtitle = `${connectedInfo.ok ? "Conectado" : "No conectado"}`;

  const iconComponent = (
    <div
      className="cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
      onClick={(e) => {
        e.stopPropagation();
        setIsDialogOpen(true);
      }}
    >
      <MessageSquareText />
    </div>
  );

  return (
    <>
      <MicrobitOutputShell
        nodeType="microbitWrite"
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
            <DialogTitle>Configurar micro:bit · Escribir</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label
                htmlFor={selectId}
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
                <SelectTrigger id={selectId}>
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
                Nota: Para que aparezca el selector de dispositivo, usa Chrome o
                Edge y ejecuta la app en localhost/https.
              </p>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Instrucciones rápidas</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                <li>
                  Conecta/enciende la micro:bit y prepara el programa que envía
                  eventos.
                </li>
                <li>
                  Presiona <span className="font-semibold">Conectar</span>. Se
                  abrirá una ventana pequeña de Chrome para seleccionar el
                  dispositivo.
                </li>
                <li>
                  Luego, al ejecutar el flujo, este nodo esperará hasta recibir
                  un mensaje de botón y lo emitirá a la salida.
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
                <Button type="button" disabled={isConnecting} onClick={connect}>
                  {isConnecting ? "Conectando…" : "Conectar"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

MicrobitWriteNode.displayName = "MicrobitWriteNode";
