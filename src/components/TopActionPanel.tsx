import { Panel } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Download, Play, Settings, Square, Upload } from "lucide-react";

export function TopActionPanel({
  nodesCount,
  isEngineRunning,
  onRunClick,
  onStopClick,
  onDownloadClick,
  onLoadClick,
  onRemoteSettingsClick,
}: {
  nodesCount: number;
  isEngineRunning: boolean;
  onRunClick: () => void;
  onStopClick: () => void;
  onDownloadClick: () => void;
  onLoadClick: () => void;
  onRemoteSettingsClick?: () => void;
}) {
  return (
    <Panel position="top-right" className="flex gap-2">
      <Button
        variant="secondary"
        className="hover:cursor-pointer shadow-md"
        type="button"
        onClick={onRunClick}
        disabled={nodesCount === 0 || isEngineRunning}
      >
        Ejecutar
        <Play fill="oklch(72.3% 0.219 149.579)" className="text-green-500" />
      </Button>
      <Button
        variant="secondary"
        className="hover:cursor-pointer shadow-md"
        type="button"
        onClick={onStopClick}
        disabled={nodesCount === 0}
        title="Detener ejecución y resetear nodos"
      >
        Detener
        <Square className="text-red-500" />
      </Button>
      <Button
        variant="secondary"
        className="hover:cursor-pointer shadow-md"
        type="button"
        onClick={onDownloadClick}
        disabled={nodesCount === 0}
      >
        Descargar
        <Download />
      </Button>
      <Button
        variant="secondary"
        className="hover:cursor-pointer shadow-md"
        type="button"
        onClick={onLoadClick}
      >
        Cargar
        <Upload />
      </Button>
      <Button
        variant="secondary"
        className="hover:cursor-pointer shadow-md"
        type="button"
        onClick={onRemoteSettingsClick}
      >
        Configurar remoto <Settings />
      </Button>
    </Panel>
  );
}
