import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { NODE_TYPES } from "@/common/constants";
import { getNodeDescription } from "@/flow/node-palette";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

type ProcessingRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  subtitle?: string;
  runtimeError?: string | null;
  inputCount?: 1 | 2 | 3;
  onConfigClick?: () => void;
  onConnectClick?: () => void;
};

export function ProcessingRectNodeShell({
  nodeType,
  icon,
  label,
  subtitle,
  runtimeError,
  inputCount = 2,
  onConfigClick,
  onConnectClick,
}: ProcessingRectNodeShellProps) {
  const in1Mask = getPortTypeMask({
    nodeType,
    handleType: "target",
    handleId: "in-1",
  });
  const in2Mask = getPortTypeMask({
    nodeType,
    handleType: "target",
    handleId: "in-2",
  });
  const in3Mask = getPortTypeMask({
    nodeType,
    handleType: "target",
    handleId: "in-3",
  });
  const outMask = getPortTypeMask({
    nodeType,
    handleType: "source",
    handleId: "out",
  });

  const in1Type = maskToVisualPortDataType(in1Mask);
  const in2Type = maskToVisualPortDataType(in2Mask);
  const in3Type = maskToVisualPortDataType(in3Mask);
  const outType = maskToVisualPortDataType(outMask);
  const isMathOperation = nodeType === NODE_TYPES.MATH_OPERATION_NODE;
  const inputLabelsByNodeType: Record<string, [string, string]> = {
    power: ["Base", "Exponente"],
    root: ["Número", "Grado"],
    logarithm: ["Número", "Base"],
  };
  const inputLabels = inputLabelsByNodeType[nodeType] ?? [];
  const hasInputLabels = inputLabels.length > 0;

  return (
    <BaseNode
      runtimeError={runtimeError}
      infoDescription={getNodeDescription(nodeType) ?? undefined}
      onConfigClick={onConfigClick}
      onConnectClick={onConnectClick}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-sky-700 bg-sky-500 text-center text-white shadow-md ${
        hasInputLabels ? "h-20 w-34 px-6" : "h-18 w-25 px-5"
      }`}
    >
      <div
        className={`flex flex-col items-center gap-0.5 ${
          hasInputLabels ? "ml-12" : ""
        }`}
      >
        {onConfigClick ? (
          <button
            type="button"
            className="nodrag nopan rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 hover:cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onConfigClick();
            }}
            aria-label="Configurar nodo"
          >
            <span
              className={`${isMathOperation ? "text-2xl" : "text-xl"} font-bold leading-none`}
            >
              {icon}
            </span>
          </button>
        ) : (
          <div
            className={`${isMathOperation ? "text-2xl" : "text-xl"} font-bold leading-none`}
          >
            {icon}
          </div>
        )}
        <div
          className={`${hasInputLabels ? "text-base" : isMathOperation ? "text-xs" : "text-sm"} leading-tight`}
        >
          {label}
        </div>
        {subtitle && (
          <div className="text-xs leading-tight text-white/85">{subtitle}</div>
        )}
      </div>

      <CustomTypedHandle
        type="target"
        position={Position.Left}
        style={{
          top: inputCount === 1 ? "50%" : inputCount === 2 ? "35%" : "30%",
        }}
        id="in-1"
        dataType={in1Type}
        typeMask={in1Mask}
        className="absolute -left-1 h-4 w-4 -translate-y-1/2"
        indicatorClassName="border-sky-700"
      />
      {inputCount >= 2 && (
        <CustomTypedHandle
          type="target"
          position={Position.Left}
          style={{ top: inputCount === 2 ? "65%" : "50%" }}
          id="in-2"
          dataType={in2Type}
          typeMask={in2Mask}
          className="absolute -left-1 h-4 w-4 -translate-y-1/2"
          indicatorClassName="border-sky-700"
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
          className="absolute -left-1 h-4 w-4 -translate-y-1/2"
          indicatorClassName="border-sky-700"
        />
      )}
      <CustomTypedHandle
        type="source"
        position={Position.Right}
        id="out"
        dataType={outType}
        typeMask={outMask}
        className="absolute -right-1 top-1/2 h-4 w-4 -translate-y-1/2"
        indicatorClassName="border-sky-700"
      />

      {inputLabels.length === 2 && (
        <>
          {[
            { top: "35%", label: inputLabels[0] },
            { top: "65%", label: inputLabels[1] },
          ].map(({ top, label }) => (
            <div
              key={`processing-input-${label}-${top}`}
              className="nodrag pointer-events-none absolute left-2 -translate-y-1/2 text-[11px] font-medium leading-none text-white/90"
              style={{ top }}
            >
              {label}
            </div>
          ))}
        </>
      )}
    </BaseNode>
  );
}
