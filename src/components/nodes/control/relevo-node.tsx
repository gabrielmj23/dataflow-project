import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { Flag } from "lucide-react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { getNodeDescription } from "@/flow/node-palette";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

export type RelevoNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const RelevoNode = memo(({ data }: NodeProps) => {
  const { label = "Relevo", runtimeError } = (data ?? {}) as RelevoNodeData;

  const maskFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) =>
    getPortTypeMask({
      nodeType: "relevo",
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
      infoDescription={getNodeDescription("relevo") ?? undefined}
      className="relative flex min-h-18 w-25 flex-col items-center justify-center rounded-2xl border-lime-700 bg-lime-600 px-5 text-center text-white shadow-md"
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">
          <Flag className="h-5 w-5" />
        </div>
        <div className="text-sm leading-tight">{label}</div>
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
        id="in-relay"
        dataType={typeFor({ handleType: "target", handleId: "in-relay" })}
        typeMask={maskFor({ handleType: "target", handleId: "in-relay" })}
        className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2"
        indicatorClassName="border-lime-700"
      />

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

RelevoNode.displayName = "RelevoNode";
