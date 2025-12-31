import type { ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";

import { BaseNode, BaseNodeHeader } from "@/components/base-node";
import NodeSettingsButton from "@/components/ui/node-settings-button";

type ControlRectNodeShellProps = {
  icon: ReactNode;
  label: string;
  variant?: "default" | "singleInDualOut" | "singleInSingleOut";
  onConfigClick?: () => void;
};

export function ControlRectNodeShell({
  icon,
  label,
  variant = "default",
  onConfigClick,
}: ControlRectNodeShellProps) {
  return (
    <BaseNode className="relative flex h-18 w-52 flex-col items-center justify-center rounded-2xl border-orange-600 bg-orange-500 px-5 text-center text-white shadow-md">
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
            style={{ top: "35%" }}
            id="in-1"
            className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
          />
          <Handle
            type="target"
            position={Position.Left}
            style={{ top: "65%" }}
            id="in-2"
            className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
          />
        </>
      )}

      {variant === "singleInDualOut" && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="in"
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            style={{ top: "35%" }}
            id="out-1"
            className="absolute -right-1 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            style={{ top: "65%" }}
            id="out-2"
            className="absolute -right-1 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
          />
        </>
      )}

      {variant == "singleInSingleOut" && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="in"
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-orange-600 bg-white"
          />
        </>
      )}
    </BaseNode>
  );
}
