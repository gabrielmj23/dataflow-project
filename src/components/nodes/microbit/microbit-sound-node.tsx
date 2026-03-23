import { memo, useCallback, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Volume2 } from "lucide-react";

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
import {
  getMicrobitSlotOptions,
  sanitizeMicrobitSlot,
} from "@/microbit/slot-utils";

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
    transport: rawTransport,
    microbitSlot: rawMicrobitSlot,
  } = (data ?? {}) as MicrobitSoundNodeData;

  const transport: MicrobitTransport =
    rawTransport === "bluetooth" || rawTransport === "serial"
      ? rawTransport
      : "serial";
  const microbitSlot = sanitizeMicrobitSlot(rawMicrobitSlot);

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectId = useId();
  const slotSelectId = useId();

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

  const setMicrobitSlot = useCallback(
    (nextSlot: number) => {
      const safeSlot = sanitizeMicrobitSlot(nextSlot);
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  microbitSlot: safeSlot,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const connectedInfo = (() => {
    if (!isMicrobitConnected({ slot: microbitSlot })) {
      return { ok: false as const, text: "" };
    }
    const t = getMicrobitTransport({ slot: microbitSlot });
    return {
      ok: true as const,
      text:
        t === "bluetooth"
          ? `Conectado por Bluetooth (micro:bit #${microbitSlot})`
          : t === "serial"
            ? `Conectado por cable (Serial, micro:bit #${microbitSlot})`
            : `Conectado (micro:bit #${microbitSlot})`,
    };
  })();

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      await connectMicrobit({ transport, slot: microbitSlot });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [microbitSlot, transport]);

  const disconnect = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      await disconnectMicrobit({ slot: microbitSlot });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [microbitSlot]);

  const subtitle = `${connectedInfo.ok ? "Conectado" : "No conectado"}`;

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
            <div>
              <label
                htmlFor={slotSelectId}
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Dispositivo micro:bit
              </label>
              <Select
                value={String(microbitSlot)}
                onValueChange={(value) => {
                  setMicrobitSlot(Number.parseInt(value, 10));
                }}
              >
                <SelectTrigger id={slotSelectId}>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {getMicrobitSlotOptions().map((slot) => (
                    <SelectItem key={slot} value={String(slot)}>
                      Microbit #{slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Selecciona uno de los 8 dispositivos disponibles.
              </p>
            </div>

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

MicrobitSoundNode.displayName = "MicrobitSoundNode";
