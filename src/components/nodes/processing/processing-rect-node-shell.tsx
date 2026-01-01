import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";

type ProcessingRectNodeShellProps = {
  icon: ReactNode;
  label: string;
  runtimeError?: string | null;
};

export function ProcessingRectNodeShell({ icon, label, runtimeError }: ProcessingRectNodeShellProps) {
  return (
    <BaseNode
      runtimeError={runtimeError}
      className="relative flex h-18 w-52 flex-col items-center justify-center rounded-2xl border-sky-700 bg-sky-500 px-5 text-center text-white shadow-md"
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        style={{ top: "35%" }}
        id="in-1"
        className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full border border-sky-700 bg-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ top: "65%" }}
        id="in-2"
        className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full border border-sky-700 bg-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-sky-700 bg-white"
      />
    </BaseNode>
  );
}
