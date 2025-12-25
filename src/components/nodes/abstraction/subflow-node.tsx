import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";

export type SubflowNodeData = {
  label?: string;
  inCount?: number;
  outCount?: number;
};

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) {
    return [];
  }
  if (safeCount === 1) {
    return ["50%"];
  }

  const start = 15;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export const SubflowNode = memo(({ data }: NodeProps) => {
  const {
    label = "Subflujo",
    inCount: rawInCount,
    outCount: rawOutCount,
  } = (data ?? {}) as SubflowNodeData;

  const inCount = Number.isFinite(rawInCount) ? (rawInCount as number) : 3;
  const outCount = Number.isFinite(rawOutCount) ? (rawOutCount as number) : 3;

  const inOffsets = offsets(inCount);
  const outOffsets = offsets(outCount);

  return (
    <BaseNode className="relative flex w-36 flex-col items-center justify-center rounded-xl border-violet-700 bg-violet-500 px-3 py-2 text-center text-white shadow-md">
      <div className="text-sm font-semibold leading-tight">{label}</div>

      {inOffsets.map((offset, index) => (
        <Handle
          key={`l-${offset}`}
          type="target"
          position={Position.Left}
          style={{ top: offset }}
          id={`in-${index + 1}`}
          className="h-2 w-2 -translate-y-1/2 rounded-full border border-violet-700 bg-white"
        />
      ))}

      {outOffsets.map((offset, index) => (
        <Handle
          key={`r-${offset}`}
          type="source"
          position={Position.Right}
          style={{ top: offset }}
          id={`out-${index + 1}`}
          className="h-2 w-2 -translate-y-1/2 rounded-full border border-violet-700 bg-white"
        />
      ))}
    </BaseNode>
  );
});

SubflowNode.displayName = "SubflowNode";
