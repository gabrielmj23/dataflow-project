import { Panel } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

export function TopActionPanel({
  nodesCount,
  isEngineRunning,
  onRunClick,
  onStopClick,
}: {
  nodesCount: number;
  isEngineRunning: boolean;
  onRunClick: () => void;
  onStopClick: () => void;
}) {
  return (
    <Panel position="top-right" className="flex gap-2 items-center mr-4 mt-2">
      <Button
        variant="secondary"
        size="lg"
        className="bg-green-500 text-white hover:bg-green-600 rounded-full px-4 py-2"
        type="button"
        onClick={onRunClick}
        disabled={nodesCount === 0 || isEngineRunning}
      >
        Ejecutar
        <Play fill="white" className="ml-2" />
      </Button>

      <Button
        variant="secondary"
        size="lg"
        className="bg-red-500 text-white hover:bg-red-600 rounded-full px-4 py-2"
        type="button"
        onClick={onStopClick}
        disabled={!isEngineRunning || nodesCount === 0}
        title="Detener ejecución y resetear nodos"
      >
        Detener
        <Pause className="ml-2" />
      </Button>

    </Panel>
  );
}
