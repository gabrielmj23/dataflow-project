import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";

export type SubflowNodeData = {
  label?: string;
};

export const SubflowNode = memo(({ data }: NodeProps) => {
  const { label = "Subflujo" } = (data ?? {}) as SubflowNodeData;

  return (
    <BaseNode className="relative flex w-36 flex-col items-center justify-center rounded-xl border-violet-700 bg-violet-500 px-3 py-2 text-center text-white shadow-md">
      <div className="text-sm font-semibold leading-tight">{label}</div>

      {["10%", "40%", "70%"].map((offset) => (
        <Handle
          key={`l-${offset}`}
          type="target"
          position={Position.Left}
          style={{ top: offset }}
          className="h-2 w-2 -translate-y-1/2 rounded-full border border-violet-700 bg-white"
        />
      ))}

      {["10%", "40%", "70%"].map((offset) => (
        <Handle
          key={`r-${offset}`}
          type="source"
          position={Position.Right}
          style={{ top: offset }}
          className="h-2 w-2 -translate-y-1/2 rounded-full border border-violet-700 bg-white"
        />
      ))}
    </BaseNode>
  );
});

SubflowNode.displayName = "SubflowNode";
