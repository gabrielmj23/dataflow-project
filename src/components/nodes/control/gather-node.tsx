import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";
import {
  Position,
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { GitFork } from "lucide-react";
import { memo, useCallback, useEffect, useMemo } from "react";

export type GatherNodeData = {
  label?: string;
  runtimeError?: string | null;
  outputCount?: number;
};

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return ["50%"];

  const start = 20;
  const end = 80;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export const GatherNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Recolectar",
    runtimeError,
    outputCount,
  } = (data ?? {}) as GatherNodeData;

  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const safeInputCount = Math.max(0, Math.floor(outputCount ?? 0));
  const inputOffsets = useMemo(() => offsets(safeInputCount), [safeInputCount]);

  useEffect(() => {
    try {
      updateNodeInternals(id);
    } catch {
      // ignore if not mounted
    }
  }, [id, inputOffsets.length, updateNodeInternals]);

  const handleAddOutput = useCallback(() => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                outputCount: Math.max(0, Math.floor(safeInputCount)) + 1,
              },
            }
          : node,
      ),
    );
  }, [id, safeInputCount, setNodes]);

  const handleRemoveOutput = useCallback(() => {
    if (safeInputCount <= 0) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                outputCount: Math.max(0, Math.floor(safeInputCount)) - 1,
              },
            }
          : node,
      ),
    );
  }, [id, safeInputCount, setNodes]);

  const outputMask = getPortTypeMask({
    nodeType: "scatter",
    handleType: "source",
    handleId: "out",
  });
  const outputType = maskToVisualPortDataType(outputMask);

  return (
    <BaseNode
      runtimeError={runtimeError}
      className="relative flex h-40 w-18 items-center justify-center bg-transparent border-transparent shadow-none"
      hideDeleteButton={false}
      sideActionsClassName="-left-6"
      sideActions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="node"
                aria-label="Agregar entrada"
                className="pointer-events-auto rounded-sm bg-transparent p-0.5 text-(--node-action-color)"
                onClick={(event) => {
                  event.stopPropagation();
                  handleAddOutput();
                }}
              >
                +
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={6}>
              Agregar entrada
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="node"
                aria-label="Eliminar entrada"
                className="pointer-events-auto rounded-sm bg-transparent p-0.5 text-(--node-action-color)"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveOutput();
                }}
                disabled={safeInputCount <= 0}
              >
                -
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={6}>
              Eliminar entrada
            </TooltipContent>
          </Tooltip>
        </>
      }
    >
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-none border-orange-600 bg-orange-500 px-5 text-center text-white shadow-md"
        style={{
          clipPath: "polygon(0% 0%, 100% 25%, 100% 75%, 0% 100%)",
        }}
      >
        <div className="text-xl font-bold leading-none -rotate-90">
          <GitFork />
        </div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        id="out"
        dataType={outputType}
        typeMask={outputMask}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-orange-600"
      />

      {inputOffsets.map((offset, index) => {
        const id = `in-${index + 1}`;
        const mask = getPortTypeMask({
          nodeType: "scatter",
          handleType: "target",
          handleId: id,
        });
        const dt = maskToVisualPortDataType(mask);
        return (
          <CustomTypedHandle
            key={id}
            type="target"
            position={Position.Left}
            id={id}
            style={{ top: offset }}
            dataType={dt}
            typeMask={mask}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
        );
      })}
    </BaseNode>
  );
});
