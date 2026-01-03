import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode, BaseNodeHeader } from "@/components/base-node";
import NodeSettingsButton from "@/components/ui/node-settings-button";

type IoRectNodeShellProps = {
  icon: ReactNode;
  label: string;
  variant?: "default" | "sink";
  /** Optional explicit target handle ids for `sink` nodes (dynamic inputs). */
  targetHandleIds?: string[];
  onConfigClick?: () => void;
  runtimeError?: string | null;
};

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return ["50%"];

  const start = 25;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export function IoRectNodeShell({
  icon,
  label,
  variant = "default",
  targetHandleIds,
  onConfigClick,
  runtimeError,
}: IoRectNodeShellProps) {
  const targetOffsets =
    variant === "sink" ? offsets(targetHandleIds?.length ?? 1) : [];

  return (
    <BaseNode
      runtimeError={runtimeError}
      className="relative flex h-18 w-48 flex-col items-center justify-center rounded-2xl border-rose-700 bg-rose-500 px-5 text-center text-white shadow-md"
    >
      {onConfigClick && (
        <BaseNodeHeader className="absolute top-1 right-1">
          <NodeSettingsButton onClick={onConfigClick} />
        </BaseNodeHeader>
      )}
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
        <>
          {(targetHandleIds ?? ["in-1"]).map((handleId, index) => (
            <Handle
              key={`sink-in-${handleId}`}
              type="target"
              position={Position.Left}
              id={handleId}
              style={{ top: targetOffsets[index] ?? "50%" }}
              className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full border border-rose-700 bg-white"
            />
          ))}
        </>
      )}
    </BaseNode>
  );
}
