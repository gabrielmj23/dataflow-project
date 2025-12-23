import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";

type IterationRectNodeShellProps = {
  icon: ReactNode;
  label: string;
};

export function IterationRectNodeShell({ icon, label }: IterationRectNodeShellProps) {
  const offsets = ["15%", "35%", "65%", "85%"];

  return (
    <BaseNode className="relative flex h-18 w-52 flex-col items-center justify-center rounded-2xl border-teal-800 bg-teal-600 px-5 text-center text-white shadow-md">
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      {offsets.map((offset) => (
        <Handle
          key={`l-${offset}`}
          type="target"
          position={Position.Left}
          style={{ top: offset }}
          className="h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
        />
      ))}

      {offsets.map((offset) => (
        <Handle
          key={`r-${offset}`}
          type="source"
          position={Position.Right}
          style={{ top: offset }}
          className="h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
        />
      ))}
    </BaseNode>
  );
}
