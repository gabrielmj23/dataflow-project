import { memo, useCallback, useEffect, useMemo } from "react";
import {
  Position,
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { GitMerge, Minus, Plus } from "lucide-react";

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
import { getNodeDescription } from "@/flow/node-palette";

export type BarrierNodeData = {
  label?: string;
  runtimeError?: string | null;
  portCount?: number;
};

function offsets(count: number): string[] {
  const safeCount = Math.max(1, Math.floor(count));
  if (safeCount === 1) return ["50%"];

  const start = 15;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export const BarrierNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Barrera",
    runtimeError,
    portCount,
  } = (data ?? {}) as BarrierNodeData;

  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const safePortCount = Math.max(1, Math.floor(portCount ?? 1));
  const portOffsets = useMemo(() => offsets(safePortCount), [safePortCount]);
  const nodeHeight = 72 + Math.max(0, safePortCount - 1) * 12;

  useEffect(() => {
    try {
      updateNodeInternals(id);
    } catch {
      // ignore if node is not mounted yet
    }
  }, [id, portOffsets.length, updateNodeInternals]);

  const handleAddPort = useCallback(() => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                portCount: safePortCount + 1,
              },
            }
          : node,
      ),
    );
  }, [id, safePortCount, setNodes]);

  const handleRemovePort = useCallback(() => {
    if (safePortCount <= 1) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                portCount: safePortCount - 1,
              },
            }
          : node,
      ),
    );
  }, [id, safePortCount, setNodes]);

  return (
    <BaseNode
      runtimeError={runtimeError}
      infoDescription={getNodeDescription("barrier") ?? undefined}
      className="relative flex w-28 flex-col items-center justify-center rounded-none border-yellow-600 bg-yellow-500 px-3 py-2 text-center text-white shadow-md"
      style={{ height: `${nodeHeight}px` }}
      sideActionsClassName="top-auto -bottom-8 left-1/2 -translate-x-1/2 translate-y-0 flex flex-row items-center justify-center gap-2 w-auto h-auto bg-transparent backdrop-blur-none border-0 rounded-none shadow-none z-0"
      sideActions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="node"
                aria-label="Agregar puerto"
                className="pointer-events-auto rounded-sm bg-transparent p-0 text-(--node-action-color) transition-colors flex h-5 w-5 items-center justify-center"
                onClick={(event) => {
                  event.stopPropagation();
                  handleAddPort();
                }}
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Agregar entrada/salida
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="node"
                aria-label="Eliminar puerto"
                className="pointer-events-auto rounded-sm bg-transparent p-0 text-(--node-action-color) disabled:opacity-30 transition-colors flex h-5 w-5 items-center justify-center"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemovePort();
                }}
                disabled={safePortCount <= 1}
              >
                <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Eliminar entrada/salida
            </TooltipContent>
          </Tooltip>
        </>
      }
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-2xl font-bold leading-none">
          <GitMerge className="h-5 w-5" />
        </div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      {portOffsets.map((offset, index) => {
        const inId = `in-${index + 1}`;
        const inMask = getPortTypeMask({
          nodeType: "barrier",
          handleType: "target",
          handleId: inId,
        });
        const inType = maskToVisualPortDataType(inMask);

        return (
          <CustomTypedHandle
            key={inId}
            type="target"
            position={Position.Left}
            id={inId}
            style={{ top: offset }}
            dataType={inType}
            typeMask={inMask}
            className="h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-yellow-600"
          />
        );
      })}

      {portOffsets.map((offset, index) => {
        const outId = `out-${index + 1}`;
        const outMask = getPortTypeMask({
          nodeType: "barrier",
          handleType: "source",
          handleId: outId,
        });
        const outType = maskToVisualPortDataType(outMask);

        return (
          <CustomTypedHandle
            key={outId}
            type="source"
            position={Position.Right}
            id={outId}
            style={{ top: offset }}
            dataType={outType}
            typeMask={outMask}
            className="h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-yellow-600"
          />
        );
      })}
    </BaseNode>
  );
});

BarrierNode.displayName = "BarrierNode";
