import { useState } from "react";
import { Panel } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Play, Pause } from "lucide-react";
import type { EngineSpeedOption } from "@/engine/engine-speed";

export function TopActionPanel({
  nodesCount,
  isEngineRunning,
  onRunClick,
  onStopClick,
  engineSpeedOptions,
  engineSpeedId,
  onEngineSpeedChange,
}: {
  nodesCount: number;
  isEngineRunning: boolean;
  onRunClick: () => void;
  onStopClick: () => void;
  engineSpeedOptions: EngineSpeedOption[];
  engineSpeedId: string;
  onEngineSpeedChange: (id: string) => void;
}) {
  const [speedOpen, setSpeedOpen] = useState(false);
  const selectedSpeed =
    engineSpeedOptions.find((option) => option.id === engineSpeedId) ??
    engineSpeedOptions[0];
  const isDisabled = nodesCount === 0 || isEngineRunning;

  return (
    <Panel position="top-right" className="flex gap-2 items-center mr-4 mt-2">
      <div className="flex items-center overflow-hidden rounded-full bg-green-500 text-white shadow-sm">
        <Popover open={speedOpen} onOpenChange={setSpeedOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="px-3 py-2 text-sm font-semibold hover:bg-green-600 disabled:opacity-60"
              disabled={isDisabled}
              aria-label="Velocidad de ejecución"
              title="Velocidad de ejecución"
            >
              {selectedSpeed?.label ?? "x1"}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            className="w-14 border-none bg-green-500 p-1 text-white shadow-lg"
          >
            <div className="flex flex-col">
              {engineSpeedOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={"w-full rounded-md px-1 py-1 text-left text-sm hover:bg-green-600"}
                  onClick={() => {
                    onEngineSpeedChange(option.id);
                    setSpeedOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-6 w-px bg-white/40" />

        <Button
          variant="secondary"
          size="lg"
          className="bg-transparent text-white hover:bg-green-600 rounded-none rounded-r-full px-4 py-2"
          type="button"
          onClick={onRunClick}
          disabled={isDisabled}
        >
          Ejecutar
          <Play fill="white" className="ml-2" />
        </Button>
      </div>

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
