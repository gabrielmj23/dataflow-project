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

export type ScatterNodeData = {
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

export const ScatterNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Distribuir",
    runtimeError,
    outputCount,
  } = (data ?? {}) as ScatterNodeData;

  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const safeOutputCount = Math.max(0, Math.floor(outputCount ?? 0));
  const outputOffsets = useMemo(
    () => offsets(safeOutputCount),
    [safeOutputCount],
  );

  useEffect(() => {
    try {
      updateNodeInternals(id);
    } catch {
      // ignore if not mounted
    }
  }, [id, outputOffsets.length, updateNodeInternals]);

  const handleAddOutput = useCallback(() => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                outputCount: Math.max(0, Math.floor(safeOutputCount)) + 1,
              },
            }
          : node,
      ),
    );
  }, [id, safeOutputCount, setNodes]);

  const handleRemoveOutput = useCallback(() => {
    if (safeOutputCount <= 0) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                outputCount: Math.max(0, Math.floor(safeOutputCount)) - 1,
              },
            }
          : node,
      ),
    );
  }, [id, safeOutputCount, setNodes]);

  const inputMask = getPortTypeMask({
    nodeType: "scatter",
    handleType: "target",
    handleId: "in",
  });
  const inputType = maskToVisualPortDataType(inputMask);

  return (
    <BaseNode
      runtimeError={runtimeError}
      disableRuntimeStyles
      className="relative flex h-40 w-18 items-center justify-center bg-transparent border-transparent shadow-none"
      hideDeleteButton={false}
      sideActionsClassName="-right-6"
      sideActions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="node"
                aria-label="Agregar salida"
                className="pointer-events-auto rounded-sm bg-transparent p-0.5 text-(--node-action-color)"
                onClick={(event) => {
                  event.stopPropagation();
                  handleAddOutput();
                }}
              >
                +
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              Agregar salida
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="node"
                aria-label="Eliminar salida"
                className="pointer-events-auto rounded-sm bg-transparent p-0.5 text-(--node-action-color)"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveOutput();
                }}
                disabled={safeOutputCount <= 0}
              >
                -
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              Eliminar salida
            </TooltipContent>
          </Tooltip>
        </>
      }
    >
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-none border-yellow-600 bg-yellow-500 px-5 text-center text-white shadow-md"
        style={{
          clipPath: "polygon(0% 25%, 100% 0%, 100% 100%, 0% 75%)",
        }}
      >
        <div className="text-2xl font-bold leading-none rotate-90">
          <GitFork />
        </div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      <CustomTypedHandle
        type="target"
        position={Position.Left}
        id="in"
        dataType={inputType}
        typeMask={inputMask}
        indicatorClassName="border-yellow-600"
      />

      {outputOffsets.map((offset, index) => {
        const id = `out-${index + 1}`;
        const mask = getPortTypeMask({
          nodeType: "scatter",
          handleType: "source",
          handleId: id,
        });
        const dt = maskToVisualPortDataType(mask);
        return (
          <CustomTypedHandle
            key={id}
            type="source"
            position={Position.Right}
            id={id}
            style={{ top: offset }}
            dataType={dt}
            typeMask={mask}
            className="absolute -right-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-yellow-600"
          />
        );
      })}
    </BaseNode>
  );
});
