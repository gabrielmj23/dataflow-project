import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { Merge } from "lucide-react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { getNodeDescription } from "@/flow/node-palette";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

export type SelectorNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const SelectorNode = memo(({ data }: NodeProps) => {
  const { label = "Selector", runtimeError } = (data ?? {}) as SelectorNodeData;

  const maskFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) =>
    getPortTypeMask({
      nodeType: "selector",
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
      infoDescription={getNodeDescription("selector") ?? undefined}
      className="relative flex h-18 w-38 flex-col items-center justify-center rounded-2xl border-lime-700 bg-lime-600 pl-14 pr-4 text-center text-white shadow-md"
    >
      <div className="ml-auto flex flex-col items-center gap-0.5 text-right">
        <div className="text-2xl font-bold leading-none">
          <Merge className="h-6 w-6 rotate-90" />
        </div>
        <div className="text-base leading-tight">{label}</div>
      </div>

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
        type="target"
        position={Position.Left}
        id="in-1"
        style={{ top: "35%" }}
        dataType={typeFor({ handleType: "target", handleId: "in-1" })}
        typeMask={maskFor({ handleType: "target", handleId: "in-1" })}
        className="absolute -left-1 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-lime-700"
      />
      <div
        className="pointer-events-none absolute left-3 -translate-y-1/2 max-w-20 truncate text-[10px] font-medium leading-none text-white/90"
        style={{ top: "35%" }}
      >
        Verdadero
      </div>

      <CustomTypedHandle
        type="target"
        position={Position.Left}
        id="in-2"
        style={{ top: "65%" }}
        dataType={typeFor({ handleType: "target", handleId: "in-2" })}
        typeMask={maskFor({ handleType: "target", handleId: "in-2" })}
        className="absolute -left-1 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-lime-700"
      />
      <div
        className="pointer-events-none absolute left-3 -translate-y-1/2 max-w-20 truncate text-[10px] font-medium leading-none text-white/90"
        style={{ top: "65%" }}
      >
        Falso
      </div>

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        id="out"
        dataType={typeFor({ handleType: "source", handleId: "out" })}
        typeMask={maskFor({ handleType: "source", handleId: "out" })}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border-lime-700"
      />
    </BaseNode>
  );
});

SelectorNode.displayName = "SelectorNode";
