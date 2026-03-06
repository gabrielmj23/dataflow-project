import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";
import { getNodeDescription } from "@/flow/node-palette";

export type TextRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  subtitle?: string;
  runtimeError?: string | null;
  inputCount?: 1 | 2 | 3;
  onConnectClick?: () => void;
};

export function TextRectNodeShell({
  nodeType,
  icon,
  label,
  subtitle,
  runtimeError,
  inputCount = 2,
  onConnectClick,
}: TextRectNodeShellProps) {
  const inputLabels = (() => {
    if (nodeType === "replaceText") return ["Texto", "Buscar", "Nuevo"];
    if (nodeType === "subtractText") return ["Texto", "Eliminar"];
    if (nodeType === "sliceText") return ["Texto", "Inicio", "Fin"];
    return [] as string[];
  })();
  const inputOffsets =
    inputCount === 1
      ? ["50%"]
      : inputCount === 2
        ? ["35%", "65%"]
        : ["30%", "50%", "70%"];

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
      onConnectClick={onConnectClick}
      className="relative flex h-18 w-36 flex-col justify-center rounded-2xl border-fuchsia-700 bg-fuchsia-600 px-6 text-white shadow-md"
      infoDescription={getNodeDescription(nodeType) ?? undefined}
    >
      <div className={`flex flex-col gap-0.5 items-center ${inputLabels.length > 0 ? "ml-10" : ""}`}>
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
        {subtitle && (
          <div className="text-xs leading-tight text-white/85">{subtitle}</div>
        )}
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

      {inputLabels.length > 0 &&
        inputOffsets.map((offset, index) => {
          const text = inputLabels[index];
          if (!text) return null;
          return (
            <div
              key={`input-label-${text}-${offset}`}
              className="nodrag pointer-events-none absolute left-2 -translate-y-1/2 text-[9px] font-medium leading-none text-white/90"
              style={{ top: offset }}
            >
              {text}
            </div>
          );
        })}
    </BaseNode>
  );
}
