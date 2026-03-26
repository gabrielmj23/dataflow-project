import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { Split } from "lucide-react";

import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import type { PortDataType } from "@/flow/port-data-type";

export type SubflowOutputNodeData = {
  label?: string;
  outputType?: PortDataType;
};

export const SubflowOutputNode = memo(({ data }: NodeProps) => {
  const { label = "Salida", outputType = "any" } = (data ??
    {}) as SubflowOutputNodeData;

  return (
    <div className="relative flex h-14 w-14 flex-col items-center justify-center rounded-full border bg-white text-foreground">
      <Split className="h-5 w-5 text-muted-foreground rotate-90" />

      <CustomTypedHandle
        type="target"
        position={Position.Left}
        id="value"
        dataType={outputType}
        className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border"
      />

      <div className="pointer-events-none absolute top-full mt-1 w-32 text-center text-[10px] leading-tight text-muted-foreground">
        {label}
      </div>
    </div>
  );
});

SubflowOutputNode.displayName = "SubflowOutputNode";
