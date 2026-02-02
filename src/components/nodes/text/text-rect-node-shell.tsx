import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

export type TextRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  runtimeError?: string | null;
  inputCount?: 1 | 2 | 3;
};

export function TextRectNodeShell({
  nodeType,
  icon,
  label,
  runtimeError,
  inputCount = 2,
}: TextRectNodeShellProps) {
  const in1Mask = getPortTypeMask({ nodeType, handleType: "target", handleId: "in-1" });
  const in2Mask = getPortTypeMask({ nodeType, handleType: "target", handleId: "in-2" });
  const in3Mask = getPortTypeMask({ nodeType, handleType: "target", handleId: "in-3" });
  const outMask = getPortTypeMask({ nodeType, handleType: "source", handleId: "out" });

  const in1Type = maskToVisualPortDataType(in1Mask);
  const in2Type = maskToVisualPortDataType(in2Mask);
  const in3Type = maskToVisualPortDataType(in3Mask);
  const outType = maskToVisualPortDataType(outMask);

  return (
    <BaseNode
      runtimeError={runtimeError}
      className="relative flex h-18 w-25 flex-col items-center justify-center rounded-2xl border-fuchsia-700 bg-fuchsia-600 px-5 text-center text-white shadow-md"
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      <CustomTypedHandle
        type="target"
        position={Position.Left}
        style={{ top: inputCount === 1 ? "50%" : inputCount === 2 ? "35%" : "30%" }}
        id="in-1"
        dataType={in1Type}
        typeMask={in1Mask}
        className="absolute -left-1 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-fuchsia-700"
      />
      {inputCount >= 2 && (
        <CustomTypedHandle
          type="target"
          position={Position.Left}
          style={{ top: inputCount === 2 ? "65%" : "50%" }}
          id="in-2"
          dataType={in2Type}
          typeMask={in2Mask}
          className="absolute -left-1 h-2 w-2 -translate-y-1/2"
          indicatorClassName="border-fuchsia-700"
        />
      )}
      {inputCount === 3 && (
        <CustomTypedHandle
          type="target"
          position={Position.Left}
          style={{ top: "70%" }}
          id="in-3"
          dataType={in3Type}
          typeMask={in3Mask}
          className="absolute -left-1 h-2 w-2 -translate-y-1/2"
          indicatorClassName="border-fuchsia-700"
        />
      )}
      <CustomTypedHandle
        type="source"
        position={Position.Right}
        id="out"
        dataType={outType}
        typeMask={outMask}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-fuchsia-700"
      />
    </BaseNode>
  );
}
