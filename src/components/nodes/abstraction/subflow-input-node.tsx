import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { Braces, X } from "lucide-react";

import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useReactFlow } from "@xyflow/react";

export type SubflowInputNodeData = {
  label?: string;
  iconVariant?: "x" | "braces";
  onLabelChange?: (nextLabel: string) => void;
};

export const SubflowInputNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Valor de entrada",
    iconVariant = "x",
    onLabelChange,
  } = (data ?? {}) as SubflowInputNodeData;
  const { setNodes } = useReactFlow();

  return (
    <div className="relative flex h-14 w-14 flex-col items-center justify-center rounded-full border bg-transparent text-foreground">
      {iconVariant === "braces" ? (
        <Braces className="h-5 w-5 text-muted-foreground" />
      ) : (
        <X className="h-5 w-5 text-muted-foreground" />
      )}

      <CustomTypedHandle
        type="source"
        position={Position.Right}
        id="value"
        dataType="any"
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
        indicatorClassName="border"
      />

      <div
        className="pointer-events-auto absolute top-full mt-1 w-32 text-center text-[10px] leading-tight text-muted-foreground bg-transparent shadow-none nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(() => {
          const isEmpty = !String(label ?? "").trim();
          const containerClass = isEmpty
            ? "rounded border border-destructive/60"
            : "";

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`${containerClass} nodrag nopan`}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Input
                    value={label}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const next = String(e.currentTarget.value || "");
                      if (typeof onLabelChange === "function") {
                        onLabelChange(next);
                        return;
                      }
                      setNodes((prev) =>
                        prev.map((n) =>
                          n.id === id
                            ? {
                                ...n,
                                data: {
                                  ...(n.data ?? {}),
                                  label: next,
                                },
                              }
                            : n,
                        ),
                      );
                    }}
                    className="h-6 w-full text-[11px] text-center border-0 bg-transparent px-2 placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/50 focus:bg-white/10 focus:outline-none rounded shadow-none nodrag nopan"
                  />
                </div>
              </TooltipTrigger>
              {isEmpty ? (
                <TooltipContent
                  sideOffset={6}
                  className="border-destructive/30 bg-destructive/10 text-destructive"
                >
                  No se puede dejar vacío
                </TooltipContent>
              ) : null}
            </Tooltip>
          );
        })()}
      </div>
    </div>
  );
});

SubflowInputNode.displayName = "SubflowInputNode";
