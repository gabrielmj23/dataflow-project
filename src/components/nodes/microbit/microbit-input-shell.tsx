import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

type MicrobitInputShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  onConfigClick?: () => void;
  variant?: "inputOnly" | "inputOutput";
  /**
   * When true, disables visual runtime state styles (borders/halos).
   * Defaults to true for input nodes.
   */
  disableRuntimeStyles?: boolean;
};

export function MicrobitInputShell({
  nodeType,
  icon,
  label,
  onConfigClick,
  variant = "inputOnly",
  disableRuntimeStyles = true,
}: MicrobitInputShellProps) {
  const inputMask = getPortTypeMask({
    nodeType,
    handleType: "target",
    handleId: null,
  });
  const inputType = maskToVisualPortDataType(inputMask);
  const outputMask = getPortTypeMask({
    nodeType,
    handleType: "source",
    handleId: null,
  });
  const outputType = maskToVisualPortDataType(outputMask);

  return (
    <BaseNode
      hideRuntimeBadges
      disableRuntimeStyles={disableRuntimeStyles}
      onConfigClick={onConfigClick}
      className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-sky-700 bg-sky-600 text-center text-white shadow-md"
    >
      <div className="flex items-center justify-center">{icon}</div>
      <div className="mt-1 text-sm leading-tight">{label}</div>

      {variant === "inputOutput" && (
        <CustomTypedHandle
          type="target"
          position={Position.Left}
          dataType={inputType}
          typeMask={inputMask}
          className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2"
          indicatorClassName="border-sky-700"
        />
      )}

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        dataType={outputType}
        typeMask={outputMask}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-sky-700"
      />
    </BaseNode>
  );
}
