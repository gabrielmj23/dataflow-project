import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { getNodeDescription } from "@/flow/node-palette";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

type InputCircleNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  /** Optional className for the label text. */
  labelClassName?: string;
  onConfigClick?: () => void;
  variant?: "inputOnly" | "inputOutput";
  /** Optional secondary text line (e.g., countdown). */
  sublabel?: string | null;
  /** Optional className for the sublabel text. */
  sublabelClassName?: string;
  /** Optional container className override (colors/background). */
  className?: string;
  /** Optional handle indicator border class override. */
  indicatorClassName?: string;
  /**
   * When true, disables visual runtime state styles (borders/halos).
   * Defaults to true for input nodes.
   */
  disableRuntimeStyles?: boolean;
};

export function InputCircleNodeShell({
  nodeType,
  icon,
  label,
  onConfigClick,
  variant = "inputOnly",
  sublabel,
  className,
  indicatorClassName,
  sublabelClassName,
  labelClassName,
  disableRuntimeStyles = true,
}: InputCircleNodeShellProps) {
  const inputMask = getPortTypeMask({ nodeType, handleType: "target", handleId: null });
  const inputType = maskToVisualPortDataType(inputMask);
  const outputMask = getPortTypeMask({ nodeType, handleType: "source", handleId: null });
  const outputType = maskToVisualPortDataType(outputMask);

  return (
    <BaseNode
      infoDescription={getNodeDescription(nodeType) ?? undefined}
      hideRuntimeBadges
      disableRuntimeStyles={disableRuntimeStyles}
      onConfigClick={onConfigClick}
      className={
        className ??
        "relative flex h-16 w-16 flex-col items-center justify-center rounded-full border-emerald-600 bg-emerald-500 text-center text-white shadow-md"
      }
    >
      <div className="flex items-center justify-center">{icon}</div>
        <div className={["mt-1 leading-tight truncate max-w-16", "text-[9px]", "text-white", typeof labelClassName === "string" ? labelClassName : ""].join(" ")}>{label}</div>
      {sublabel ? (
        <div
          className={
            typeof sublabelClassName === "string"
              ? ["mt-0.5 leading-tight text-white truncate max-w-16", sublabelClassName].join(" ")
              : ["mt-0.5 leading-tight text-white truncate max-w-16", "text-[9px]"].join(" ")
          }
        >
          {sublabel}
        </div>
      ) : null}

      {variant === "inputOutput" && (
        <CustomTypedHandle
          type="target"
          position={Position.Left}
          dataType={inputType}
          typeMask={inputMask}
          className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2"
          indicatorClassName={indicatorClassName ?? "border-emerald-600"}
        />
      )}

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        dataType={outputType}
        typeMask={outputMask}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName={indicatorClassName ?? "border-emerald-600"}
      />
    </BaseNode>
  );
}
