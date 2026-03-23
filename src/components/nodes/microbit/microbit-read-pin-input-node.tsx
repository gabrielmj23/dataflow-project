import { memo, useCallback, useId, useMemo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Cpu } from "lucide-react";

import { MicrobitInputShell } from "@/components/nodes/microbit/microbit-input-shell";
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

const MICROBIT_DIGITAL_PIN_OPTIONS = [
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
  "P11",
  "P12",
  "P13",
  "P14",
  "P15",
  "P16",
] as const;
const MICROBIT_ANALOG_READ_PIN_OPTIONS = [
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "P10",
] as const;

type MicrobitPinName = (typeof MICROBIT_DIGITAL_PIN_OPTIONS)[number];

type MicrobitPinMode = "digital" | "analog";

function sanitizePin(value: unknown, mode: MicrobitPinMode): MicrobitPinName {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const allowedPins =
    mode === "analog"
      ? (MICROBIT_ANALOG_READ_PIN_OPTIONS as readonly string[])
      : (MICROBIT_DIGITAL_PIN_OPTIONS as readonly string[]);
  return allowedPins.includes(raw) ? (raw as MicrobitPinName) : "P0";
}

function sanitizeMode(value: unknown): MicrobitPinMode {
  return value === "analog" ? "analog" : "digital";
}

export type MicrobitReadPinNodeData = {
  label?: string;
  transport?: MicrobitTransport;
  microbitSlot?: number;
  pin?: MicrobitPinName;
  mode?: MicrobitPinMode;
};

export const MicrobitReadPinInputNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Leer pin",
    transport: rawTransport,
    microbitSlot: rawMicrobitSlot,
    pin: rawPin,
    mode: rawMode,
  } = (data ?? {}) as MicrobitReadPinNodeData;

  const transport: MicrobitTransport =
    rawTransport === "bluetooth" || rawTransport === "serial"
      ? rawTransport
      : "serial";
  const microbitSlot = sanitizeMicrobitSlot(rawMicrobitSlot);
  const mode = sanitizeMode(rawMode);
  const pin = sanitizePin(rawPin, mode);

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transportSelectId = useId();
  const slotSelectId = useId();
  const pinSelectId = useId();
  const modeSelectId = useId();

  const patchData = useCallback(
    (patch: Partial<MicrobitReadPinNodeData>) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
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

  const iconComponent = useMemo(() => {
    return (
      <div
        className="flex flex-col items-center leading-none cursor-pointer hover:scale-110 transition-transform"
        onClick={(e) => {
          e.stopPropagation();
          setIsDialogOpen(true);
        }}
      >
        <Cpu className="h-7 w-7" />
      </div>
    );
  }, []);

  return (
    <>
      <MicrobitInputShell
        nodeType="microbitReadPin"
        icon={iconComponent}
        label={label}
        onConfigClick={() => setIsDialogOpen(true)}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar micro:bit · Leer pin</DialogTitle>
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
                onValueChange={(v) => {
                  patchData({ microbitSlot: sanitizeMicrobitSlot(v) });
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
                htmlFor={transportSelectId}
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Metodo de conexion
              </label>
              <Select
                value={transport}
                onValueChange={(v) => {
                  if (v === "serial" || v === "bluetooth") {
                    patchData({ transport: v });
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={pinSelectId}
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Pin
                </label>
                <Select
                  value={pin}
                  onValueChange={(v) => {
                    patchData({ pin: sanitizePin(v, mode) });
                  }}
                >
                  <SelectTrigger id={pinSelectId}>
                    <SelectValue placeholder="Pin" />
                  </SelectTrigger>
                  <SelectContent>
                    {(mode === "analog"
                      ? MICROBIT_ANALOG_READ_PIN_OPTIONS
                      : MICROBIT_DIGITAL_PIN_OPTIONS
                    ).map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor={modeSelectId}
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Modo
                </label>
                <Select
                  value={mode}
                  onValueChange={(v) => {
                    const nextMode = sanitizeMode(v);
                    patchData({
                      mode: nextMode,
                      pin: sanitizePin(pin, nextMode),
                    });
                  }}
                >
                  <SelectTrigger id={modeSelectId}>
                    <SelectValue placeholder="Modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="analog">Analogico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Nota: Para que aparezca el selector de dispositivo, usa Chrome o
              Edge y ejecuta la app en localhost/https.
            </p>

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
                  {isConnecting ? "Conectando..." : "Conectar"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

MicrobitReadPinInputNode.displayName = "MicrobitReadPinInputNode";
