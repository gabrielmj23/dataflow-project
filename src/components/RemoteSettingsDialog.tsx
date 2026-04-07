import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMicrobitSlotOptions } from "@/microbit/slot-utils";
import type { MicrobitConnectionType } from "@/microbit/slot-manager";
import {
  connectMicrobitSlot,
  disconnectMicrobitSlot,
  useConnectedMicrobitDevices,
} from "@/microbit/use-microbit-slot";
import type { RemoteConfig, RemoteRole } from "@/ws/remote-config";

type Props = {
  config: RemoteConfig;
  onChange: (next: RemoteConfig) => void;
  onReset: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed;
}

function defaultWsUrlFromLocation(): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  return `${scheme}://${host}:8787`;
}

function resolveDefaultDialogUrl(currentUrl: string): string {
  const envUrl = normalizeUrl(import.meta.env.VITE_WS_URL ?? "");
  const normalizedCurrent = normalizeUrl(currentUrl);

  if (!envUrl) {
    return normalizedCurrent;
  }

  if (!normalizedCurrent || normalizedCurrent === defaultWsUrlFromLocation()) {
    return envUrl;
  }

  return normalizedCurrent;
}

export function RemoteSettingsDialog({
  config,
  onChange,
  onReset,
  open,
  setOpen,
}: Props) {
  const connectedMicrobits = useConnectedMicrobitDevices();
  const connectedSlots = useMemo(
    () => new Set(connectedMicrobits.map((device) => device.slot)),
    [connectedMicrobits],
  );
  const availableMicrobitSlots = useMemo(
    () => getMicrobitSlotOptions().filter((slot) => !connectedSlots.has(slot)),
    [connectedSlots],
  );
  const [draftRole, setDraftRole] = useState<RemoteRole>(config.role);
  const [draftUrl, setDraftUrl] = useState(resolveDefaultDialogUrl(config.url));
  const [draftSessionKey, setDraftSessionKey] = useState(config.sessionKey);
  const [draftClientName, setDraftClientName] = useState(
    config.clientName ?? "",
  );
  const [draftMicrobitSlot, setDraftMicrobitSlot] = useState(1);
  const [draftMicrobitTransport, setDraftMicrobitTransport] =
    useState<MicrobitConnectionType>("serial");
  const [busyMicrobitSlot, setBusyMicrobitSlot] = useState<number | null>(null);
  const [microbitError, setMicrobitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (availableMicrobitSlots.length === 0) return;
    if (availableMicrobitSlots.includes(draftMicrobitSlot)) return;
    setDraftMicrobitSlot(availableMicrobitSlots[0]);
  }, [open, availableMicrobitSlots, draftMicrobitSlot]);

  useEffect(() => {
    if (!open) return;

    setDraftRole(config.role);
    setDraftUrl(resolveDefaultDialogUrl(config.url));
    setDraftSessionKey(config.sessionKey);
    setDraftClientName(config.clientName ?? "");
  }, [open, config.role, config.url, config.sessionKey, config.clientName]);

  const canSave = useMemo(() => {
    if (draftRole === "disabled") return true;
    return !!draftSessionKey.trim() && !!normalizeUrl(draftUrl);
  }, [draftRole, draftSessionKey, draftUrl]);

  const connectDraftMicrobit = async () => {
    if (!availableMicrobitSlots.includes(draftMicrobitSlot)) {
      setMicrobitError(
        "Ese slot ya está conectado. Elige uno disponible para conectar otra micro:bit.",
      );
      return;
    }

    setBusyMicrobitSlot(draftMicrobitSlot);
    setMicrobitError(null);
    try {
      await connectMicrobitSlot({
        slot: draftMicrobitSlot,
        connectionType: draftMicrobitTransport,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMicrobitError(message);
    } finally {
      setBusyMicrobitSlot(null);
    }
  };

  const disconnectConnectedMicrobit = async (slot: number) => {
    setBusyMicrobitSlot(slot);
    setMicrobitError(null);
    try {
      await disconnectMicrobitSlot({ slot });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMicrobitError(message);
    } finally {
      setBusyMicrobitSlot(null);
    }
  };

  const save = () => {
    if (!canSave) return;

    const next: RemoteConfig = {
      role: draftRole,
      url: normalizeUrl(draftUrl) || config.url,
      sessionKey: draftSessionKey.trim() || "DEV",
      clientName: draftClientName.trim() || undefined,
    };

    onChange(next);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conexiones</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="remote" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="remote">Sesión remota</TabsTrigger>
            <TabsTrigger value="microbit">Micro:bit</TabsTrigger>
          </TabsList>

          <TabsContent value="remote" className="mt-4 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Rol</label>
              <Select
                value={draftRole}
                onValueChange={(v) => setDraftRole(v as RemoteRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">Deshabilitado</SelectItem>
                  <SelectItem value="runner">
                    Local (tengo el código)
                  </SelectItem>
                  <SelectItem value="controller">
                    Remoto (no tengo el código)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">URL del servidor</label>
              <Input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.currentTarget.value)}
                placeholder="ws://localhost:8787"
                disabled={draftRole === "disabled"}
              />
              <div className="text-xs text-muted-foreground">
                En la misma PC normalmente es{" "}
                <span className="font-mono">ws://localhost:8787</span>.
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Clave de sesión</label>
              <Input
                value={draftSessionKey}
                onChange={(e) => setDraftSessionKey(e.currentTarget.value)}
                placeholder="DEV"
                disabled={draftRole === "disabled"}
              />
              <p className="text-xs text-muted-foreground">
                Los dispositivos deben usar la misma clave para conectarse entre
                sí.
              </p>
            </div>

            {draftRole === "controller" && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Nombre del controller
                </label>
                <Input
                  value={draftClientName}
                  onChange={(e) => setDraftClientName(e.currentTarget.value)}
                  placeholder="Laboratorio A"
                />
                <div className="text-xs text-muted-foreground">
                  Este nombre se mostrará en la lista de controllers conectados.
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onReset}>
                Restablecer
              </Button>
              <Button type="button" onClick={save} disabled={!canSave}>
                Guardar
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="microbit" className="mt-4">
            <div>
              <div className="mb-3">
                <h3 className="text-sm font-medium">Dispositivos micro:bit</h3>
                <p className="text-xs text-muted-foreground">
                  Conecta o quita micro:bits desde aquí para luego
                  seleccionarlas en los nodos.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <div className="grid gap-1">
                  <label className="text-xs font-medium">Micro:bit</label>
                  <Select
                    value={
                      availableMicrobitSlots.includes(draftMicrobitSlot)
                        ? String(draftMicrobitSlot)
                        : undefined
                    }
                    onValueChange={(value) => {
                      const next = Number.parseInt(value, 10);
                      if (Number.isFinite(next)) {
                        setDraftMicrobitSlot(next);
                      }
                    }}
                    disabled={availableMicrobitSlots.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMicrobitSlots.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          Sin slots disponibles
                        </SelectItem>
                      ) : (
                        availableMicrobitSlots.map((slot) => (
                          <SelectItem key={slot} value={String(slot)}>
                            Micro:bit #{slot}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <label className="text-xs font-medium">Método</label>
                  <Select
                    value={draftMicrobitTransport}
                    onValueChange={(value) => {
                      if (value === "serial" || value === "bluetooth") {
                        setDraftMicrobitTransport(value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serial">Cable</SelectItem>
                      <SelectItem value="bluetooth">Bluetooth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  onClick={() => void connectDraftMicrobit()}
                  disabled={
                    busyMicrobitSlot !== null ||
                    availableMicrobitSlots.length === 0
                  }
                >
                  {busyMicrobitSlot === draftMicrobitSlot
                    ? "Conectando..."
                    : "Conectar"}
                </Button>
              </div>

              {availableMicrobitSlots.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Ya no hay slots libres (1-8). Quita una micro:bit conectada
                  para conectar otra.
                </p>
              ) : null}

              <div className="mt-3 space-y-2">
                {connectedMicrobits.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay micro:bits conectadas.
                  </p>
                ) : (
                  connectedMicrobits.map((device) => {
                    const transportLabel =
                      device.connectionType === "bluetooth"
                        ? "Bluetooth"
                        : "Serial";

                    return (
                      <div
                        key={device.slot}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            Micro:bit #{device.slot}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Conectada por {transportLabel}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busyMicrobitSlot !== null}
                          onClick={() =>
                            void disconnectConnectedMicrobit(device.slot)
                          }
                        >
                          {busyMicrobitSlot === device.slot
                            ? "Quitando..."
                            : "Quitar"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>

              {microbitError ? (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  {microbitError}
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
