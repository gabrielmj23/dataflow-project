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

type IterationRectNodeShellProps = {
  nodeType: string;
  icon: ReactNode;
  label: string;
  subtitle?: string;
  variant?:
    | "multi"
    | "singleInDoubleOut"
    | "singleInSingleOut"
    | "doubleInSingleOut"
    | "tripleInSingleOut"
    | "dynamicInSingleOut"
    | "source";
  targetHandleIds?: string[];
  targetHandleLabels?: Array<string | null | undefined>;
  targetHandlePlaceholders?: Array<string | null | undefined>;
  invalidTargetHandleIds?: string[];
  onTargetHandleLabelChange?: (params: {
    handleId: string;
    label: string;
  }) => void;
  sideActions?: ReactNode;
  sideActionsClassName?: string;
  onConfigClick?: () => void;
  onConnectClick?: () => void;
  className?: string;
  indicatorClassName?: string;
};

export function IterationRectNodeShell({
  nodeType,
  icon,
  label,
  subtitle,
  variant = "multi",
  targetHandleIds,
  targetHandleLabels,
  targetHandlePlaceholders,
  invalidTargetHandleIds,
  onTargetHandleLabelChange,
  sideActions,
  sideActionsClassName,
  onConfigClick,
  onConnectClick,
  className,
  indicatorClassName,
}: IterationRectNodeShellProps) {
  const offsets = ["15%", "35%", "65%", "85%"];
  const inputLabels =
    variant === "tripleInSingleOut" &&
    (nodeType === "sequence" || nodeType === "pulseSequence")
      ? ["Inicio", "Fin", "Paso"]
      : variant === "doubleInSingleOut" && nodeType === "listAtPosition"
        ? ["Lista", "Posición"]
        : variant === "doubleInSingleOut" && nodeType === "listFindElement"
          ? ["Lista", "Elemento"]
          : variant === "doubleInSingleOut" &&
              (nodeType === "runtimeInputPulse" ||
                nodeType === "microbitReadButtonPulse" ||
                nodeType === "microbitReadTemperaturePulse" ||
                nodeType === "microbitReadPinPulse")
            ? ["Frecuencia", "Cantidad"]
            : variant === "doubleInSingleOut" &&
                (nodeType === "listPrepend" || nodeType === "listAppend")
              ? ["Lista", "Elemento"]
              : [];

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

  const dynamicTargetOffsets = (() => {
    const ids = targetHandleIds ?? ["in"];
    if (ids.length <= 1) return ["50%"];

    const start = 25;
    const end = 85;
    const step = (end - start) / (ids.length - 1);
    return Array.from({ length: ids.length }, (_, i) => `${start + step * i}%`);
  })();

  const hasDynamicTargetLabels =
    variant === "dynamicInSingleOut" &&
    (targetHandleLabels ?? []).some(
      (text) => typeof text === "string" && text.trim().length > 0,
    );

  const dynamicHandleCount =
    variant === "dynamicInSingleOut" ? (targetHandleIds ?? ["in"]).length : 1;
  const dynamicMinHeight = 72 + Math.max(0, dynamicHandleCount - 1) * 18;
  const [focusedHandleId, setFocusedHandleId] = useState<string | null>(null);

  const rootClass =
    className ??
    `relative flex ${
      variant === "dynamicInSingleOut" ? "h-auto" : "h-18"
    } ${hasDynamicTargetLabels ? "w-52" : "w-36"} flex-col justify-center rounded-2xl border-teal-800 bg-teal-600 px-6 text-center text-white shadow-md`;
  const handleIndicatorClass = indicatorClassName ?? "border-teal-800";

  return (
    <BaseNode
      infoDescription={getNodeDescription(nodeType) ?? undefined}
      onConfigClick={onConfigClick}
      onConnectClick={onConnectClick}
      sideActions={sideActions}
      sideActionsClassName={sideActionsClassName}
      className={rootClass}
      style={
        variant === "dynamicInSingleOut"
          ? { minHeight: `${dynamicMinHeight}px` }
          : undefined
      }
    >
      <div
        className={`flex flex-col items-center gap-0.5 ${
          hasDynamicTargetLabels
            ? "ml-14"
            : inputLabels.length > 0
              ? "ml-10"
              : ""
        }`}
      >
        {onConfigClick ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Configurar nodo"
            className="nodrag nopan text-lg font-bold leading-none cursor-pointer transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            onClick={(event) => {
              event.stopPropagation();
              onConfigClick();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onConfigClick();
              }
            }}
          >
            {icon}
          </div>
        ) : (
          <div className="text-lg font-bold leading-none">{icon}</div>
        )}
        <div className="text-xs leading-tight">{label}</div>
        {subtitle && (
          <div className="text-[10px] leading-tight text-white/85">
            {subtitle}
          </div>
        )}
      </div>

      {variant === "source" && (
        <CustomTypedHandle
          type="source"
          position={Position.Right}
          id="out"
          dataType={typeFor({ handleType: "source", handleId: "out" })}
          typeMask={maskFor({ handleType: "source", handleId: "out" })}
          className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
          indicatorClassName={handleIndicatorClass}
        />
      )}

      {variant === "multi" && (
        <>
          {offsets.map((offset, index) =>
            (() => {
              const id = `in-${index}`;
              const mask = maskFor({ handleType: "target", handleId: id });
              const dt = maskToVisualPortDataType(mask);
              return (
                <CustomTypedHandle
                  key={`l-${offset}`}
                  type="target"
                  position={Position.Left}
                  style={{ top: offset }}
                  id={id}
                  dataType={dt}
                  typeMask={mask}
                  className="h-2 w-2 -translate-y-1/2"
                  indicatorClassName={handleIndicatorClass}
                />
              );
            })(),
          )}

          {offsets.map((offset, index) =>
            (() => {
              const id = `out-${index}`;
              const mask = maskFor({ handleType: "source", handleId: id });
              const dt = maskToVisualPortDataType(mask);
              return (
                <CustomTypedHandle
                  key={`r-${offset}`}
                  type="source"
                  position={Position.Right}
                  style={{ top: offset }}
                  id={id}
                  dataType={dt}
                  typeMask={mask}
                  className="h-2 w-2 -translate-y-1/2"
                  indicatorClassName={handleIndicatorClass}
                />
              );
            })(),
          )}
        </>
      )}

      {variant === "singleInSingleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            id="in"
            dataType={typeFor({ handleType: "target", handleId: "in" })}
            typeMask={maskFor({ handleType: "target", handleId: "in" })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
        </>
      )}

      {variant === "dynamicInSingleOut" && (
        <>
          {(targetHandleIds ?? ["in"]).map((handleId, index) => {
            const mask = maskFor({ handleType: "target", handleId });
            const dt = maskToVisualPortDataType(mask);
            return (
              <CustomTypedHandle
                key={`iter-dynamic-in-${handleId}`}
                type="target"
                position={Position.Left}
                id={handleId}
                style={{ top: dynamicTargetOffsets[index] ?? "50%" }}
                dataType={dt}
                typeMask={mask}
                className="absolute -left-1 h-2 w-2 -translate-y-1/2"
                indicatorClassName={handleIndicatorClass}
              />
            );
          })}

          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />

          {(targetHandleIds ?? ["in"]).map((handleId, index) => {
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
                  key={`iter-dynamic-label-edit-${handleId}`}
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
                      className={`nodrag absolute left-3 h-6 -translate-y-1/2 bg-transparent px-1 text-left text-[8px] font-normal leading-tight text-white placeholder:text-white/70 shadow-none focus:outline-none focus:ring-0 focus-visible:ring-0 ${borderClass}`}
                      style={{
                        top: dynamicTargetOffsets[index] ?? "50%",
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
                key={`iter-dynamic-label-${handleId}`}
                className="pointer-events-none absolute left-3 max-w-36 -translate-y-1/2 truncate text-left text-[8px] font-normal leading-tight text-white"
                style={{ top: dynamicTargetOffsets[index] ?? "50%" }}
                title={normalized}
              >
                {normalized}
              </span>
            );
          })}
        </>
      )}

      {variant === "singleInDoubleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            id="in"
            dataType={typeFor({ handleType: "target", handleId: "in" })}
            typeMask={maskFor({ handleType: "target", handleId: "in" })}
            className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />

          <CustomTypedHandle
            type="source"
            position={Position.Right}
            style={{ top: "40%" }}
            id="out-1"
            dataType={typeFor({ handleType: "source", handleId: "out-1" })}
            typeMask={maskFor({ handleType: "source", handleId: "out-1" })}
            className="absolute -right-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />

          <CustomTypedHandle
            type="source"
            position={Position.Right}
            style={{ top: "60%" }}
            id="out-2"
            dataType={typeFor({ handleType: "source", handleId: "out-2" })}
            typeMask={maskFor({ handleType: "source", handleId: "out-2" })}
            className="absolute -right-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
        </>
      )}

      {variant === "doubleInSingleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "35%" }}
            id="in-1"
            dataType={typeFor({ handleType: "target", handleId: "in-1" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-1" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "65%" }}
            id="in-2"
            dataType={typeFor({ handleType: "target", handleId: "in-2" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-2" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
        </>
      )}

      {variant === "tripleInSingleOut" && (
        <>
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "25%" }}
            id="in-1"
            dataType={typeFor({ handleType: "target", handleId: "in-1" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-1" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "50%" }}
            id="in-2"
            dataType={typeFor({ handleType: "target", handleId: "in-2" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-2" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
          <CustomTypedHandle
            type="target"
            position={Position.Left}
            style={{ top: "75%" }}
            id="in-3"
            dataType={typeFor({ handleType: "target", handleId: "in-3" })}
            typeMask={maskFor({ handleType: "target", handleId: "in-3" })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
          <CustomTypedHandle
            type="source"
            position={Position.Right}
            id="out"
            dataType={typeFor({ handleType: "source", handleId: "out" })}
            typeMask={maskFor({ handleType: "source", handleId: "out" })}
            className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
            indicatorClassName={handleIndicatorClass}
          />
        </>
      )}

      {inputLabels.length === 3 && (
        <>
          {[
            { top: "25%", label: inputLabels[0] },
            { top: "50%", label: inputLabels[1] },
            { top: "75%", label: inputLabels[2] },
          ].map(({ top, label }) => (
            <div
              key={`iter-input-${label}-${top}`}
              className="nodrag pointer-events-none absolute left-2 -translate-y-1/2 text-[8px] font-medium leading-none text-white/90"
              style={{ top }}
            >
              {label}
            </div>
          ))}
        </>
      )}

      {inputLabels.length === 2 && (
        <>
          {[
            { top: "35%", label: inputLabels[0] },
            { top: "65%", label: inputLabels[1] },
          ].map(({ top, label }) => (
            <div
              key={`iter-input-${label}-${top}`}
              className="nodrag pointer-events-none absolute left-2 -translate-y-1/2 text-[8px] font-medium leading-none text-white/90"
              style={{ top }}
            >
              {label}
            </div>
          ))}
        </>
      )}
    </BaseNode>
  );
}
