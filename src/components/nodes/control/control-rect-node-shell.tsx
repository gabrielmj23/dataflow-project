import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { getNodeDescription } from "@/flow/node-palette";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

type ControlRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  subtitle?: string;
  /** optional extra className to merge with the default shell classes */
  className?: string;
  variant?:
    | "default"
    | "singleInDualOut"
    | "singleInSingleOut"
    | "singleInMultiOut";
  /**
   * Number of outputs to render when `variant` is `singleInMultiOut`.
   */
  outputCount?: number;
  /**
   * Optional explicit output handle ids for `singleInMultiOut`.
   * When provided, it overrides the default `out-1..out-N` ids.
   */
  outputHandleIds?: string[];
  onConfigClick?: () => void;
  onConnectClick?: () => void;
  runtimeError?: string | null;
};

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return ["50%"];

  const start = 15;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export function ControlRectNodeShell({
  nodeType,
  icon,
  label,
  subtitle,
  variant = "default",
  outputCount,
  outputHandleIds,
  onConfigClick,
  onConnectClick,
  runtimeError,
  className,
}: ControlRectNodeShellProps) {
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

  const outCount =
    variant === "singleInMultiOut"
      ? outputHandleIds?.length ?? outputCount ?? 0
      : 0;

  const outOffsets = variant === "singleInMultiOut" ? offsets(outCount) : [];

  const baseClass = "relative flex h-18 w-25 flex-col items-center justify-center rounded-2xl border-orange-600 bg-orange-500 px-5 text-center text-white shadow-md";

  return (
    <BaseNode
      runtimeError={runtimeError}
      infoDescription={getNodeDescription(nodeType) ?? undefined}
      onConfigClick={onConfigClick}
      onConnectClick={onConnectClick}
      className={className ? `${baseClass} ${className}` : baseClass}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
        {subtitle && (
          <div className="text-xs leading-tight text-white/85">
            {subtitle}
          </div>
        )}
      </div>

      {variant === "default" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "35%" }}
            id="in-1"
            dataType={typeFor({ handleType: "target", handleId: "in-1" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-1" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "65%" }}
            id="in-2"
            dataType={typeFor({ handleType: "target", handleId: "in-2" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-2" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
        </>
      )}

      {variant === "singleInDualOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            id="in"
            dataType={typeFor({ handleType: "target", handleId: "in" })}
            typeMask={maskFor({ handleType: "target", handleId: "in" })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            style={{ top: "35%" }}
            id="out-1"
            dataType={typeFor({ handleType: "source", handleId: "out-1" })}
            typeMask={maskFor({ handleType: "source", handleId: "out-1" })}
            className="absolute -right-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            style={{ top: "65%" }}
            id="out-2"
            dataType={typeFor({ handleType: "source", handleId: "out-2" })}
            typeMask={maskFor({ handleType: "source", handleId: "out-2" })}
            className="absolute -right-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
        </>
      )}

      {variant === "singleInMultiOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            id="in"
            dataType={typeFor({ handleType: "target", handleId: "in" })}
            typeMask={maskFor({ handleType: "target", handleId: "in" })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />

          {outOffsets.map((offset, index) => (
            (() => {
              const id = outputHandleIds?.[index] ?? `out-${index + 1}`;
              const mask = maskFor({ handleType: "source", handleId: id });
              const dt = maskToVisualPortDataType(mask);
              return (
            <CustomTypedHandle
              key={`r-${offset}`}
              type="source"
              position={Position.Right}
              style={{ top: offset }}
              id={id}
              dataType={dt}
              typeMask={mask}
              className="absolute -right-1 h-2 w-2 -translate-y-1/2"
              indicatorClassName="border-orange-600"
            />
              );
            })()
          ))}
        </>
      )}

      {variant == "singleInSingleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            id="in"
            dataType={typeFor({ handleType: "target", handleId: "in" })}
            typeMask={maskFor({ handleType: "target", handleId: "in" })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
        </>
      )}
    </BaseNode>
  );
}
