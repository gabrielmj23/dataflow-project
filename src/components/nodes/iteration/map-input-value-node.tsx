import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { X } from "lucide-react";

import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";

export type MapInputValueNodeData = {
  label?: string;
};

export const MapInputValueNode = memo(({ data }: NodeProps) => {
  const { label = "Valor de entrada" } = (data ?? {}) as MapInputValueNodeData;

  return (
    <div className="relative flex h-16 w-16 flex-col items-center justify-center rounded-full border bg-transparent text-foreground">
      <X className="h-4 w-4 text-muted-foreground" />

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        id="value"
        dataType="any"
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border"
      />

      <div className="pointer-events-none absolute top-full mt-1 w-24 text-center text-[10px] leading-tight text-muted-foreground">
        {label}
      </div>
    </div>
  );
});

MapInputValueNode.displayName = "MapInputValueNode";
