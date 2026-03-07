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
  const [draftRole, setDraftRole] = useState<RemoteRole>(config.role);
  const [draftUrl, setDraftUrl] = useState(resolveDefaultDialogUrl(config.url));
  const [draftSessionKey, setDraftSessionKey] = useState(config.sessionKey);
  const [draftClientName, setDraftClientName] = useState(
    config.clientName ?? "",
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftRole(config.role);
    setDraftUrl(resolveDefaultDialogUrl(config.url));
    setDraftSessionKey(config.sessionKey);
    setDraftClientName(config.clientName ?? "");
  }, [open, config.role, config.url, config.sessionKey, config.clientName]);

  const canSave = useMemo(() => {
    if (draftRole === "disabled") return true;
    return !!draftSessionKey.trim() && !!normalizeUrl(draftUrl);
  }, [draftRole, draftSessionKey, draftUrl]);

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sesión remota</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
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
                <SelectItem value="runner">Local (tengo el código)</SelectItem>
                <SelectItem value="controller">Remoto (no tengo el código)</SelectItem>
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
            <div className="text-xs text-muted-foreground">
              Los dispositivos deben usar la misma clave para conectarse entre
              sí.
            </div>
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
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onReset}>
            Restablecer
          </Button>
          <Button type="button" onClick={save} disabled={!canSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
