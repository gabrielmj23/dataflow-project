import type { ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import NodeSettingsButton from "@/components/ui/node-settings-button";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

type IterationRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  variant?:
    | "multi"
    | "singleInSingleOut"
    | "doubleInSingleOut"
    | "tripleInSingleOut"
    | "source";
  onConfigClick?: () => void;
};

export function IterationRectNodeShell({
  nodeType,
  icon,
  label,
  variant = "multi",
  onConfigClick,
}: IterationRectNodeShellProps) {
  const offsets = ["15%", "35%", "65%", "85%"];

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
    <BaseNode className="relative flex h-18 w-52 flex-col items-center justify-center rounded-2xl border-teal-800 bg-teal-600 px-5 text-center text-white shadow-md">
      {onConfigClick && (
        <div className="absolute top-1 right-1">
          <NodeSettingsButton onClick={onConfigClick} />
        </div>
      )}
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
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
            })()
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
            })()
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
    </BaseNode>
  );
}
