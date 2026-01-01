import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";

type IoRectNodeShellProps = {
  icon: ReactNode;
  label: string;
  variant?: "default" | "sink";
  runtimeError?: string | null;
};

export function IoRectNodeShell({ icon, label, variant = "default", runtimeError }: IoRectNodeShellProps) {
  return (
    <BaseNode
      runtimeError={runtimeError}
      className="relative flex h-18 w-48 flex-col items-center justify-center rounded-2xl border-rose-700 bg-rose-500 px-5 text-center text-white shadow-md"
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      {variant === "default" && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-rose-700 bg-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-rose-700 bg-white"
          />
        </>
      )}

      {variant === "sink" && (
        <Handle
          type="target"
          position={Position.Left}
          className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-rose-700 bg-white"
        />
      )}
    </BaseNode>
  );
}
