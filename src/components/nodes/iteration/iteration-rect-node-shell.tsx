import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";

type IterationRectNodeShellProps = {
  icon: ReactNode;
  label: string;
  variant?: "multi" | "singleInSingleOut" | "doubleInSingleOut";
};

export function IterationRectNodeShell({ icon, label, variant = "multi" }: IterationRectNodeShellProps) {
  const offsets = ["15%", "35%", "65%", "85%"];

  return (
    <BaseNode className="relative flex h-18 w-52 flex-col items-center justify-center rounded-2xl border-teal-800 bg-teal-600 px-5 text-center text-white shadow-md">
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">{icon}</div>
        <div className="text-sm leading-tight">{label}</div>
      </div>

      {variant === "multi" && (
        <>
          {offsets.map((offset, index) => (
            <Handle
              key={`l-${offset}`}
              type="target"
              position={Position.Left}
              style={{ top: offset }}
              id={`in-${index}`}
              className="h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
            />
          ))}

          {offsets.map((offset, index) => (
            <Handle
              key={`r-${offset}`}
              type="source"
              position={Position.Right}
              style={{ top: offset }}
              id={`out-${index}`}
              className="h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
            />
          ))}
        </>
      )}

      {variant === "singleInSingleOut" && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="in"
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
          />
        </>
      )}

      {variant === "doubleInSingleOut" && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            style={{ top: "35%" }}
            id="in-1"
            className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
          />
          <Handle
            type="target"
            position={Position.Left}
            style={{ top: "65%" }}
            id="in-2"
            className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-teal-800 bg-white"
          />
        </>
      )}
    </BaseNode>
  );
}
