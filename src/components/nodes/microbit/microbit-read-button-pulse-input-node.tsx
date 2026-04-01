import { memo, useCallback, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Cpu } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
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

export type MicrobitReadButtonPulseNodeData = {
  label?: string;
  transport?: MicrobitTransport;
  microbitSlot?: number;
};

export const MicrobitReadButtonPulseInputNode = memo(
  ({ id, data }: NodeProps) => {
    const {
      label = "Botón pulsos",
      transport: rawTransport,
      microbitSlot: rawMicrobitSlot,
    } = (data ?? {}) as MicrobitReadButtonPulseNodeData;

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

    return (
      <>
        <IterationRectNodeShell
          nodeType="microbitReadButtonPulse"
          icon={<Cpu className="h-4 w-4" />}
          label={label}
          variant="doubleInSingleOut"
          className="relative flex h-18 w-36 flex-col justify-center rounded-2xl border-sky-700 bg-sky-600 px-6 text-center text-white shadow-md"
          indicatorClassName="border-sky-700"
          onConfigClick={() => setIsDialogOpen(true)}
        />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar micro:bit · Botón pulsos</DialogTitle>
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
                  onValueChange={(v) => {
                    if (v === "serial" || v === "bluetooth") setTransport(v);
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
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

MicrobitReadButtonPulseInputNode.displayName =
  "MicrobitReadButtonPulseInputNode";
