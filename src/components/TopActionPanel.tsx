import { Panel } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Download, Play, Settings, Pause, Upload } from "lucide-react";

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
        className="bg-green-600 text-white hover:bg-green-700"
        type="button"
        onClick={onRunClick}
        disabled={nodesCount === 0 || isEngineRunning}
      >
        Ejecutar
        <Play fill="white" className="text-white" />
      </Button>
      <Button
        variant="secondary"
        className="bg-red-600 text-white hover:bg-red-700"
        type="button"
        onClick={onStopClick}
        disabled={!isEngineRunning || nodesCount === 0}
        title="Detener ejecución y resetear nodos"
      >
        Detener
        <Pause className="text-white" />
      </Button>
      <Button
        variant="secondary"
        className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-600"
        type="button"
        onClick={onDownloadClick}
        disabled={nodesCount === 0}
      >
        Descargar
        <Download className="text-white" />
      </Button>
      <Button
        variant="secondary"
        className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-600"
        type="button"
        onClick={onLoadClick}
      >
        Cargar
        <Upload className="text-white" />
      </Button>
      <Button
        variant="secondary"
        className="bg-slate-600 text-white hover:bg-slate-700 disabled:bg-gray-300 disabled:text-gray-600"
        type="button"
        onClick={onRemoteSettingsClick}
      >
        Configurar remoto <Settings className="text-white" />
      </Button>
    </Panel>
  );
}
