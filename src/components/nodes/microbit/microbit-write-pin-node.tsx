import { memo, useCallback, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { PenSquare } from "lucide-react";

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

const MICROBIT_PIN_OPTIONS = ["P0", "P1", "P2", "P3", "P4", "P10"] as const;
type MicrobitPinName = (typeof MICROBIT_PIN_OPTIONS)[number];

type MicrobitPinMode = "digital" | "analog";

function sanitizePin(value: unknown): MicrobitPinName {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (MICROBIT_PIN_OPTIONS as readonly string[]).includes(raw)
    ? (raw as MicrobitPinName)
    : "P0";
}

function sanitizeMode(value: unknown): MicrobitPinMode {
  return value === "analog" ? "analog" : "digital";
}

export type MicrobitWritePinNodeData = {
  label?: string;
  runtimeError?: string | null;
  transport?: MicrobitTransport;
  pin?: MicrobitPinName;
  mode?: MicrobitPinMode;
};

export const MicrobitWritePinNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Escribir en pin",
    runtimeError,
    transport: rawTransport,
    pin: rawPin,
    mode: rawMode,
  } = (data ?? {}) as MicrobitWritePinNodeData;

  const transport: MicrobitTransport =
    rawTransport === "bluetooth" || rawTransport === "serial"
      ? rawTransport
      : "serial";
  const pin = sanitizePin(rawPin);
  const mode = sanitizeMode(rawMode);

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transportSelectId = useId();
  const pinSelectId = useId();
  const modeSelectId = useId();

  const patchData = useCallback(
    (patch: Partial<MicrobitWritePinNodeData>) => {
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

  const subtitle = `${pin} · ${mode === "analog" ? "Analogico" : "Digital"} · ${transport === "bluetooth" ? "Bluetooth" : "Serial"}`;

  const iconComponent = (
    <div
      className="cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
      onClick={(e) => {
        e.stopPropagation();
        setIsDialogOpen(true);
      }}
    >
      <PenSquare />
    </div>
  );

  return (
    <>
      <MicrobitOutputShell
        nodeType="microbitWritePin"
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
            <DialogTitle>Configurar micro:bit · Escribir en pin</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
                    patchData({ pin: sanitizePin(v) });
                  }}
                >
                  <SelectTrigger id={pinSelectId}>
                    <SelectValue placeholder="Pin" />
                  </SelectTrigger>
                  <SelectContent>
                    {MICROBIT_PIN_OPTIONS.map((item) => (
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
                    patchData({ mode: sanitizeMode(v) });
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
              El valor a escribir entra por el puerto izquierdo. En modo digital
              se interpreta como 0/1; en modo analogico se limita a 0..1023.
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

MicrobitWritePinNode.displayName = "MicrobitWritePinNode";
