import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

type IterationRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  subtitle?: string;
  variant?:
    | "multi"
    | "singleInDoubleOut"
    | "singleInSingleOut"
    | "doubleInSingleOut"
    | "tripleInSingleOut"
    | "source";
  onConfigClick?: () => void;
  onConnectClick?: () => void;
};

export function IterationRectNodeShell({
  nodeType,
  icon,
  label,
  subtitle,
  variant = "multi",
  onConfigClick,
  onConnectClick,
}: IterationRectNodeShellProps) {
  const offsets = ["15%", "35%", "65%", "85%"];
  const inputLabels =
    variant === "tripleInSingleOut" &&
    (nodeType === "sequence" || nodeType === "pulseSequence")
      ? ["Inicio", "Fin", "Paso"]
      : variant === "doubleInSingleOut" && nodeType === "listAtPosition"
        ? ["Lista", "Posición"]
        : variant === "doubleInSingleOut" && nodeType === "listFindElement"
          ? ["Lista", "Elemento"]
        : variant === "doubleInSingleOut" &&
            (nodeType === "listPrepend" || nodeType === "listAppend")
          ? ["Lista", "Elemento"]
      : [];

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

  return (
    <BaseNode
      onConfigClick={onConfigClick}
      onConnectClick={onConnectClick}
      className="relative flex h-18 w-36 flex-col justify-center rounded-2xl border-teal-800 bg-teal-600 px-6 text-center text-white shadow-md"
    >
      <div
        className={`flex flex-col items-center gap-0.5 ${
          inputLabels.length > 0 ? "ml-10" : ""
        }`}
      >
        <div className="text-lg font-bold leading-none">{icon}</div>
        <div className="text-xs leading-tight">{label}</div>
        {subtitle && (
          <div className="text-[10px] leading-tight text-white/85">
            {subtitle}
          </div>
        )}
      </div>

      {variant === "source" && (
        <CustomTypedHandle
          type="source"
          position={Position.Right}
          id="out"
          dataType={typeFor({ handleType: "source", handleId: "out" })}
          typeMask={maskFor({ handleType: "source", handleId: "out" })}
          className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
          indicatorClassName="border-teal-800"
        />
      )}

      {variant === "multi" && (
        <>
          {offsets.map((offset, index) =>
            (() => {
              const id = `in-${index}`;
              const mask = maskFor({ handleType: "target", handleId: id });
              const dt = maskToVisualPortDataType(mask);
              return (
                <CustomTypedHandle
                  key={`l-${offset}`}
                  type="target"
                  position={Position.Left}
                  style={{ top: offset }}
                  id={id}
                  dataType={dt}
                  typeMask={mask}
                  className="h-2 w-2 -translate-y-1/2"
                  indicatorClassName="border-teal-800"
                />
              );
            })(),
          )}

          {offsets.map((offset, index) =>
            (() => {
              const id = `out-${index}`;
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
                  className="h-2 w-2 -translate-y-1/2"
                  indicatorClassName="border-teal-800"
                />
              );
            })(),
          )}
        </>
      )}

      {variant === "singleInSingleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            id="in"
            dataType={typeFor({ handleType: "target", handleId: "in" })}
            typeMask={maskFor({ handleType: "target", handleId: "in" })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
        </>
      )}

      {variant === "singleInDoubleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            id="in"
            dataType={typeFor({ handleType: "target", handleId: "in" })}
            typeMask={maskFor({ handleType: "target", handleId: "in" })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />

          <CustomTypedHandle
            type="source"
            position={Position.Right}
            style={{ top: "40%" }}
            id="out-1"
            dataType={typeFor({ handleType: "source", handleId: "out-1" })}
            typeMask={maskFor({ handleType: "source", handleId: "out-1" })}
            className="absolute -right-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />

          <CustomTypedHandle
            type="source"
            position={Position.Right}
            style={{ top: "60%" }}
            id="out-2"
            dataType={typeFor({ handleType: "source", handleId: "out-2" })}
            typeMask={maskFor({ handleType: "source", handleId: "out-2" })}
            className="absolute -right-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
        </>
      )}

      {variant === "doubleInSingleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "35%" }}
            id="in-1"
            dataType={typeFor({ handleType: "target", handleId: "in-1" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-1" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "65%" }}
            id="in-2"
            dataType={typeFor({ handleType: "target", handleId: "in-2" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-2" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
        </>
      )}

      {variant === "tripleInSingleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "25%" }}
            id="in-1"
            dataType={typeFor({ handleType: "target", handleId: "in-1" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-1" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "50%" }}
            id="in-2"
            dataType={typeFor({ handleType: "target", handleId: "in-2" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-2" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "75%" }}
            id="in-3"
            dataType={typeFor({ handleType: "target", handleId: "in-3" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-3" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-teal-800"
          />
        </>
      )}

      {inputLabels.length === 3 && (
        <>
          {[
            { top: "25%", label: inputLabels[0] },
            { top: "50%", label: inputLabels[1] },
            { top: "75%", label: inputLabels[2] },
          ].map(({ top, label }) => (
            <div
              key={`iter-input-${label}-${top}`}
              className="nodrag pointer-events-none absolute left-2 -translate-y-1/2 text-[9px] font-medium leading-none text-white/90"
              style={{ top }}
            >
              {label}
            </div>
          ))}
        </>
      )}

      {inputLabels.length === 2 && (
        <>
          {[
            { top: "35%", label: inputLabels[0] },
            { top: "65%", label: inputLabels[1] },
          ].map(({ top, label }) => (
            <div
              key={`iter-input-${label}-${top}`}
              className="nodrag pointer-events-none absolute left-2 -translate-y-1/2 text-[9px] font-medium leading-none text-white/90"
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
