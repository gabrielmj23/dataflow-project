import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode, BaseNodeHeader } from "@/components/base-node";
import NodeSettingsButton from "@/components/ui/node-settings-button";

type InputCircleNodeShellProps = {
  icon: ReactNode;
  label: string;
  onConfigClick?: () => void;
  variant?: "inputOnly" | "inputOutput";
  /** Optional secondary text line (e.g., countdown). */
  sublabel?: string | null;
  /**
   * When true, disables visual runtime state styles (borders/halos).
   * Defaults to true for input nodes.
   */
  disableRuntimeStyles?: boolean;
};

export function InputCircleNodeShell({
  icon,
  label,
  onConfigClick,
  variant = "inputOnly",
  sublabel,
  disableRuntimeStyles = true,
}: InputCircleNodeShellProps) {
  return (
    <BaseNode
      hideRuntimeBadges
      disableRuntimeStyles={disableRuntimeStyles}
      className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-emerald-600 bg-emerald-500 text-center text-white shadow-md"
    >
      {onConfigClick && (
        <BaseNodeHeader className="absolute top-1 right-1">
          <NodeSettingsButton onClick={onConfigClick} />
        </BaseNodeHeader>
      )}
      <div className="flex items-center justify-center">{icon}</div>
      <div className="mt-1 text-sm leading-tight">{label}</div>
      {sublabel ? (
        <div className="mt-0.5 text-[11px] leading-tight text-white/90">
          {sublabel}
        </div>
      ) : null}

      {variant === "inputOutput" && (
        <Handle
          type="target"
          position={Position.Left}
          className="absolute left-1 top-1/2 h-2 w-2 rounded-full border border-emerald-600 bg-white"
        />
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-emerald-600 bg-white"
      />
    </BaseNode>
  );
}
