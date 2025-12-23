import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";

type InputCircleNodeShellProps = {
  icon: ReactNode;
  label: string;
};

export function InputCircleNodeShell({ icon, label }: InputCircleNodeShellProps) {
  return (
    <BaseNode className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-emerald-600 bg-emerald-500 text-center text-white shadow-md">
      <div className="flex items-center justify-center">{icon}</div>
      <div className="mt-1 text-sm leading-tight">{label}</div>

      <Handle
        type="source"
        position={Position.Right}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-emerald-600 bg-white"
      />
    </BaseNode>
  );
}
