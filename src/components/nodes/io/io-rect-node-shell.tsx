import { useState, type ReactNode } from "react";

import { Position } from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { getNodeDescription } from "@/flow/node-palette";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

type IoRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  variant?: "default" | "sink";
  /** Optional explicit target handle ids for `sink` nodes (dynamic inputs). */
  targetHandleIds?: string[];
  /** Optional labels aligned with `targetHandleIds` (sink only). */
  targetHandleLabels?: Array<string | null | undefined>;
  /** Optional placeholders aligned with `targetHandleIds` (sink only). */
  targetHandlePlaceholders?: Array<string | null | undefined>;
  /** Optional list of invalid handle ids (sink only). */
  invalidTargetHandleIds?: string[];
  /** Optional callback to edit labels inline (sink only). */
  onTargetHandleLabelChange?: (params: {
    handleId: string;
    label: string;
  }) => void;
  onConfigClick?: () => void;
  sideActions?: ReactNode;
  sideActionsClassName?: string;
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
  nodeType,
  icon,
  label,
  variant = "default",
  targetHandleIds,
  targetHandleLabels,
  targetHandlePlaceholders,
  invalidTargetHandleIds,
  onTargetHandleLabelChange,
  onConfigClick,
  sideActions,
  sideActionsClassName,
  runtimeError,
}: IoRectNodeShellProps) {
  const maskFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) =>
    getPortTypeMask({
      nodeType,
      handleType: params.handleType,
      handleId: params.handleId ?? null,
    });

  const typeFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) => maskToVisualPortDataType(maskFor(params));

  const sinkHandleCount = (targetHandleIds ?? ["in-1"]).length;
  const sinkMinHeight = 72 + Math.max(0, sinkHandleCount - 1) * 18;

  const targetOffsets =
    variant === "sink" ? offsets(targetHandleIds?.length ?? 1) : [];
  const hasTargetLabels =
    variant === "sink" &&
    (targetHandleLabels ?? []).some(
      (text) => typeof text === "string" && text.trim().length > 0,
    );
  const [focusedHandleId, setFocusedHandleId] = useState<string | null>(null);

  return (
    <BaseNode
      runtimeError={runtimeError}
      infoDescription={getNodeDescription(nodeType) ?? undefined}
      onConfigClick={onConfigClick}
      sideActions={sideActions}
      sideActionsClassName={sideActionsClassName}
      className={`relative flex ${variant === "sink" ? "h-auto" : "h-18"} ${hasTargetLabels ? "w-52" : "w-25"} flex-col items-center justify-center rounded-2xl border-rose-700 bg-rose-500 px-5 text-center text-white shadow-md`}
      style={
        variant === "sink" ? { minHeight: `${sinkMinHeight}px` } : undefined
      }
    >
      <div
        className={`flex flex-col items-center gap-0.5 ${hasTargetLabels ? "ml-14" : ""}`}
      >
        <div className="text-lg font-bold leading-none">{icon}</div>
        <div className="text-xs leading-tight">{label}</div>
      </div>

      {variant === "default" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            dataType={typeFor({ handleType: "target", handleId: null })}
            typeMask={maskFor({ handleType: "target", handleId: null })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-rose-700"
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            dataType={typeFor({ handleType: "source", handleId: null })}
            typeMask={maskFor({ handleType: "source", handleId: null })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-rose-700"
          />
        </>
      )}

      {variant === "sink" && (
        <>
          {(targetHandleIds ?? ["in-1"]).map((handleId, index) => {
            const mask = maskFor({ handleType: "target", handleId });
            const dt = maskToVisualPortDataType(mask);
            return (
              <CustomTypedHandle
                key={`sink-in-${handleId}`}
                type="target"
                position={Position.Left}
                id={handleId}
                style={{ top: targetOffsets[index] ?? "50%" }}
                dataType={dt}
                typeMask={mask}
                className="absolute -left-1 h-2 w-2 -translate-y-1/2"
                indicatorClassName="border-rose-700"
              />
            );
          })}

          {(targetHandleIds ?? ["in-1"]).map((handleId, index) => {
            const rawLabel = targetHandleLabels?.[index];
            if (rawLabel === null || rawLabel === undefined) return null;
            const resolved = typeof rawLabel === "string" ? rawLabel : "";
            const widthPx = Math.min(
              150,
              Math.max(56, 20 + resolved.length * 8),
            );

            if (onTargetHandleLabelChange) {
              const placeholderRaw = targetHandlePlaceholders?.[index];
              const placeholder =
                typeof placeholderRaw === "string" ? placeholderRaw : "";
              const isInvalid = (invalidTargetHandleIds ?? []).includes(
                handleId,
              );
              const isEditing = focusedHandleId === handleId;
              const borderClass = isEditing
                ? isInvalid
                  ? "border border-red-300 focus-visible:border-red-200"
                  : "border border-white/55 focus-visible:border-white/70"
                : "border border-transparent";
              return (
                <Tooltip
                  key={`sink-label-edit-${handleId}`}
                  open={isInvalid && isEditing ? true : undefined}
                >
                  <TooltipTrigger asChild>
                    <Input
                      value={resolved}
                      placeholder={placeholder}
                      aria-invalid={isInvalid || undefined}
                      onFocus={() => setFocusedHandleId(handleId)}
                      onBlur={() =>
                        setFocusedHandleId((prev) =>
                          prev === handleId ? null : prev,
                        )
                      }
                      onChange={(event) =>
                        onTargetHandleLabelChange({
                          handleId,
                          label: event.currentTarget.value,
                        })
                      }
                      className={`nodrag absolute left-3 h-6 -translate-y-1/2 bg-transparent px-1 text-left text-[11px] font-normal leading-tight text-white placeholder:text-white/70 shadow-none focus:outline-none focus:ring-0 focus-visible:ring-0 ${borderClass}`}
                      style={{
                        top: targetOffsets[index] ?? "50%",
                        width: `${widthPx}px`,
                      }}
                    />
                  </TooltipTrigger>
                  {isInvalid ? (
                    <TooltipContent
                      side="top"
                      sideOffset={6}
                      className="border-red-300/50 bg-red-500/10 text-red-100"
                    >
                      Nombre repetido
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              );
            }

            const normalized = resolved.trim();
            if (!normalized) return null;

            return (
              <span
                key={`sink-label-${handleId}`}
                className="pointer-events-none absolute left-3 max-w-36 -translate-y-1/2 truncate text-left text-[11px] font-normal leading-tight text-white"
                style={{ top: targetOffsets[index] ?? "50%" }}
                title={normalized}
              >
                {normalized}
              </span>
            );
          })}
        </>
      )}
    </BaseNode>
  );
}
