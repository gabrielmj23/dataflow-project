import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";

type ControlRectNodeShellProps = {
  icon: ReactNode;
  label: string;
};

export function ControlRectNodeShell({ icon, label }: ControlRectNodeShellProps) {
  return (
    <BaseNode className="relative flex h-18 w-52 flex-col items-center justify-center rounded-2xl border-orange-600 bg-orange-500 px-5 text-center text-white shadow-md">
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
      />
    </BaseNode>
  );
}
