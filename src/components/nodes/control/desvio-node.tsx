import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { getNodeDescription } from "@/flow/node-palette";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";
import { Split } from "lucide-react";

export type DesvioNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const DesvioNode = memo(({ data }: NodeProps) => {
  const { label = "Desvio", runtimeError } = (data ?? {}) as DesvioNodeData;

  const maskFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) =>
    getPortTypeMask({
      nodeType: "desvio",
      handleType: params.handleType,
      handleId: params.handleId ?? null,
    });

  const typeFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) => maskToVisualPortDataType(maskFor(params));

  return (
    <BaseNode
      runtimeError={runtimeError}
      infoDescription={getNodeDescription("desvio") ?? undefined}
      className="relative flex h-18 w-38 flex-col items-center justify-center rounded-2xl border-lime-700 bg-lime-600 pl-4 pr-14 text-center text-white shadow-md"
    >
      <div className="flex flex-col items-center gap-0.5 text-left">
        <div className="text-2xl font-bold rotate-90">
          <Split />
        </div>
        <div className="text-base leading-tight">{label}</div>
      </div>

      <CustomTypedHandle
        type="target"
        position={Position.Left}
        id="in"
        dataType={typeFor({ handleType: "target", handleId: "in" })}
        typeMask={maskFor({ handleType: "target", handleId: "in" })}
        className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-lime-700"
      />

      <CustomTypedHandle
        type="target"
        position={Position.Top}
        id="in-cond"
        dataType={typeFor({ handleType: "target", handleId: "in-cond" })}
        typeMask={maskFor({ handleType: "target", handleId: "in-cond" })}
        className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2"
        indicatorClassName="border-lime-700"
      />

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        style={{ top: "35%" }}
        id="out-1"
        dataType={typeFor({ handleType: "source", handleId: "out-1" })}
        typeMask={maskFor({ handleType: "source", handleId: "out-1" })}
        className="absolute -right-1 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-lime-700"
      />
      <div
        className="pointer-events-none absolute right-3 -translate-y-1/2 max-w-16 truncate text-[10px] font-medium leading-none text-white/90"
        style={{ top: "35%" }}
      >
        Verdadero
      </div>

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        style={{ top: "65%" }}
        id="out-2"
        dataType={typeFor({ handleType: "source", handleId: "out-2" })}
        typeMask={maskFor({ handleType: "source", handleId: "out-2" })}
        className="absolute -right-1 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-lime-700"
      />
      <div
        className="pointer-events-none absolute right-3 -translate-y-1/2 max-w-16 truncate text-[10px] font-medium leading-none text-white/90"
        style={{ top: "65%" }}
      >
        Falso
      </div>
    </BaseNode>
  );
});

DesvioNode.displayName = "DesvioNode";
