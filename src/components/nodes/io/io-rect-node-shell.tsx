import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

type IoRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  variant?: "default" | "sink";
  /** Optional explicit target handle ids for `sink` nodes (dynamic inputs). */
  targetHandleIds?: string[];
  onConfigClick?: () => void;
  runtimeError?: string | null;
};

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return ["50%"];

  const start = 25;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export function IoRectNodeShell({
  nodeType,
  icon,
  label,
  variant = "default",
  targetHandleIds,
  onConfigClick,
  runtimeError,
}: IoRectNodeShellProps) {
  const maskFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) =>
    getPortTypeMask({
      nodeType,
      handleType: params.handleType,
      handleId: params.handleId ?? null,
    });

  const typeFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) => maskToVisualPortDataType(maskFor(params));

  const targetOffsets =
    variant === "sink" ? offsets(targetHandleIds?.length ?? 1) : [];

  return (
    <BaseNode
      runtimeError={runtimeError}
      onConfigClick={onConfigClick}
      className="relative flex h-18 w-25 flex-col items-center justify-center rounded-2xl border-rose-700 bg-rose-500 px-5 text-center text-white shadow-md"
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-lg font-bold leading-none">{icon}</div>
        <div className="text-xs leading-tight">{label}</div>
      </div>

      {variant === "default" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            dataType={typeFor({ handleType: "target", handleId: null })}
            typeMask={maskFor({ handleType: "target", handleId: null })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-rose-700"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            dataType={typeFor({ handleType: "source", handleId: null })}
            typeMask={maskFor({ handleType: "source", handleId: null })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-rose-700"
          />
        </>
      )}

      {variant === "sink" && (
        <>
          {(targetHandleIds ?? ["in-1"]).map((handleId, index) => {
            const mask = maskFor({ handleType: "target", handleId });
            const dt = maskToVisualPortDataType(mask);
            return (
              <CustomTypedHandle
                key={`sink-in-${handleId}`}
                type="target"
                position={Position.Left}
                id={handleId}
                style={{ top: targetOffsets[index] ?? "50%" }}
                dataType={dt}
                typeMask={mask}
                className="absolute -left-1 h-2 w-2 -translate-y-1/2"
                indicatorClassName="border-rose-700"
              />
            );
          })}
        </>
      )}
    </BaseNode>
  );
}
