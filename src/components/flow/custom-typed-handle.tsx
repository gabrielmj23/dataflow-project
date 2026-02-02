import { Handle, type HandleProps } from "@xyflow/react";

import type { PortDataType, PortDataTypeMask } from "@/flow/port-data-type";
import { getHandleShapeClasses, isTypeCompatible, portDataTypeToMask } from "@/flow/port-data-type";
import { useConnectionHighlight } from "@/flow/connection-highlight-context";
import { cn } from "@/lib/utils";

export type CustomTypedHandleProps = Omit<HandleProps, "children"> & {
  dataType?: PortDataType;
  /** Precise allowed-type mask for compatibility (recommended for mixed-type ports like concat inputs). */
  typeMask?: PortDataTypeMask;
  /**
   * Classes applied to the visible shape (border colors, fills, etc.).
   * Example: "border border-sky-700 bg-white".
   */
  indicatorClassName?: string;
};

/**
 * XYFlow Handle with a custom visual child.
 * - The Handle itself is the interaction surface (invisible).
 * - The child draws the visible shape and must have pointer-events: none.
 */
export function CustomTypedHandle({
  dataType = "any",
  typeMask,
  indicatorClassName,
  className,
  style,
  ...props
}: CustomTypedHandleProps) {
  const highlight = useConnectionHighlight();

  const ringColorClass = (() => {
    const raw = typeof indicatorClassName === "string" ? indicatorClassName : "";

    // IMPORTANT: Tailwind cannot generate classes from dynamic strings.
    // Keep this mapping explicit so the classes are included in the build.
    if (raw.includes("border-sky-700")) return "ring-sky-700";
    if (raw.includes("border-orange-600")) return "ring-orange-600";
    if (raw.includes("border-rose-700")) return "ring-rose-700";
    if (raw.includes("border-teal-800")) return "ring-teal-800";
    if (raw.includes("border-emerald-600")) return "ring-emerald-600";
    if (raw.includes("border-violet-700")) return "ring-violet-700";

    return "ring-ring";
  })();

  const shouldHighlight =
    Boolean(highlight) &&
    props.type === "target" &&
    isTypeCompatible({
      sourceType: highlight!.sourceMask,
      targetType: typeMask ?? portDataTypeToMask(dataType),
    });

  return (
    <Handle
      {...props}
      className={cn(
        "relative border-0! bg-transparent!",
        // If callers pass width/height via classes (e.g. h-2 w-2), keep them.
        className
      )}
      style={{
        ...style,
        background: "none",
        border: "none",
      }}
      data-port-type={dataType}
    >
      <div
        className={cn(
          "pointer-events-none absolute left-0 top-0 h-full w-full border bg-white",
          getHandleShapeClasses(dataType),
          indicatorClassName,
          shouldHighlight &&
            // On very small handles (h-2 w-2), ring-offset can cover the border.
            // Keep it simple and visible: a colored ring without offset.
            cn("ring-2", ringColorClass)
        )}
      />
    </Handle>
  );
}
