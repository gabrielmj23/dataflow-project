import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { X } from "lucide-react";

export type ListInputValueNodeData = {
  label?: string;
};

export const ListInputValueNode = memo(({ data }: NodeProps) => {
  const { label = "Valor de entrada" } = (data ?? {}) as ListInputValueNodeData;

  return (
    <div className="relative flex h-14 w-14 flex-col items-center justify-center rounded-full border bg-transparent text-foreground">
      <X className="h-5 w-5 text-muted-foreground" />

      <Handle
        type="source"
        position={Position.Right}
        id="value"
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border bg-white"
      />

      <div className="pointer-events-none absolute top-full mt-1 w-24 text-center text-[10px] leading-tight text-muted-foreground">
        {label}
      </div>
    </div>
  );
});

ListInputValueNode.displayName = "ListInputValueNode";
