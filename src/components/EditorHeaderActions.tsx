import {
  Cpu,
  Download,
  Lock,
  Monitor,
  Plug,
  Unlock,
  Upload,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EdgeFeedbackMode } from "@/flow/edge-feedback-mode";

type ConnectedDevice = {
  id: string;
  name?: string;
  kind?: DeviceKind;
};

type DeviceKind = "microbit" | "pc";

function detectDeviceKind(device: ConnectedDevice): DeviceKind {
  if (device.kind) return device.kind;
  const normalized = `${device.name ?? ""} ${device.id}`.toLowerCase();
  if (
    normalized.includes("micro:bit") ||
    normalized.includes("microbit") ||
    normalized.includes("micro-bit") ||
    normalized.includes("mbit")
  ) {
    return "microbit";
  }
  return "pc";
}

function getDeviceLabel(device: ConnectedDevice): string {
  const name = typeof device.name === "string" ? device.name.trim() : "";
  return name.length > 0 ? name : device.id;
}

function getDeviceVisual(kind: DeviceKind): {
  label: string;
  Icon: LucideIcon;
} {
  if (kind === "microbit") {
    return { label: "micro:bit", Icon: Cpu };
  }
  return { label: "PC", Icon: Monitor };
}

interface EditorHeaderActionsProps {
  onDownloadClick: () => void;
  onLoadClick: () => void;
  onConnectClick: () => void;
  isConnected: boolean;
  connectedDevices: ConnectedDevice[];
  edgeFeedbackMode: EdgeFeedbackMode;
  onToggleEdgeFeedbackMode: () => void;
}

export function EditorHeaderActions({
  onDownloadClick,
  onLoadClick,
  onConnectClick,
  isConnected,
  connectedDevices,
  edgeFeedbackMode,
  onToggleEdgeFeedbackMode,
}: EditorHeaderActionsProps) {
  return (
    <>
      <Button
        variant="secondary"
        className="bg-transparent text-white hover:bg-white/10"
        type="button"
        onClick={onDownloadClick}
      >
        Descargar
        <Download className="text-white" />
      </Button>
      <Button
        variant="secondary"
        className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
        type="button"
        onClick={onLoadClick}
      >
        Subir
        <Upload className="text-white" />
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
            type="button"
            onClick={onConnectClick}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${isConnected ? "bg-green-300" : "bg-white/40"}`}
              aria-hidden="true"
            />
            {isConnected ? "Conectado" : "Conectar"}
            {isConnected ? (
              <Plug className="text-white" />
            ) : (
              <Unplug className="text-white" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8} className="w-72 p-3">
          <p className="text-sm font-semibold">Dispositivos conectados</p>

          {!isConnected ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No hay conexión activa.
            </p>
          ) : null}

          {connectedDevices.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No hay dispositivos conectados.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {connectedDevices.map((device) => {
                const kind = detectDeviceKind(device);
                const visual = getDeviceVisual(kind);

                return (
                  <li
                    key={device.id}
                    className="flex items-center justify-between gap-2 rounded-sm border px-2 py-1"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <visual.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs font-medium">
                        {getDeviceLabel(device)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {visual.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
      <Button
        variant="secondary"
        className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
        type="button"
        onClick={onToggleEdgeFeedbackMode}
      >
        Mostrar valores
        {edgeFeedbackMode === "transient" ? (
          <Unlock className="ml-2 text-white" />
        ) : (
          <Lock className="ml-2 text-white" />
        )}
      </Button>
    </>
  );
}
