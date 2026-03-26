import { Handle, type HandleProps, useNodeConnections } from "@xyflow/react";

import type { PortDataType, PortDataTypeMask } from "@/flow/port-data-type";
import {
  getHandleShapeClasses,
  isTypeCompatible,
  portDataTypeToMask,
} from "@/flow/port-data-type";
import { useConnectionHighlight } from "@/flow/connection-highlight-context";
import { cn } from "@/lib/utils";

export type CustomTypedHandleProps = Omit<
  HandleProps,
  "children" | "isConnectable"
> & {
  dataType?: PortDataType;
  /** Precise allowed-type mask for compatibility (recommended for mixed-type ports like concat inputs). */
  typeMask?: PortDataTypeMask;
  /**
   * Classes applied to the visible shape (border colors, fills, etc.).
   * Example: "border border-sky-700 bg-white".
   */
  indicatorClassName?: string;
  /** Additional classes that control the rendered size/scale of the handle.
   * Use this to make handles visually larger without changing the XYFlow interaction box.
   */
  indicatorSizeClassName?: string;
  /** Custom connection limit. Defaults to 1. */
  maxConnections?: number;
};

export const DEFAULT_INDICATOR_SIZE_CLASS = "scale-150";

/**
 * XYFlow Handle with a custom visual child.
 * - The Handle itself is the interaction surface (invisible).
 * - The child draws the visible shape and must have pointer-events: none.
 */
export function CustomTypedHandle({
  dataType = "any",
  typeMask,
  indicatorClassName,
  indicatorSizeClassName,
  className,
  style,
  maxConnections = 1,
  ...props
}: CustomTypedHandleProps) {
  const connections = useNodeConnections({
    handleType: props.type,
    handleId: props.id ? String(props.id) : undefined,
  });

  const isTargetHandle = props.type === "target";
  const isConnectable = isTargetHandle
    ? connections.length < maxConnections
    : true;

  const highlight = useConnectionHighlight();

  const ringColorClass = (() => {
    const raw =
      typeof indicatorClassName === "string" ? indicatorClassName : "";

    // IMPORTANT: Tailwind cannot generate classes from dynamic strings.
    // Keep this mapping explicit so the classes are included in the build.
    if (raw.includes("border-sky-700")) return "ring-sky-700";
    if (raw.includes("border-orange-600")) return "ring-orange-600";
    if (raw.includes("border-rose-700")) return "ring-rose-700";
    if (raw.includes("border-fuchsia-700")) return "ring-fuchsia-700";
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

  const sizeClasses = cn(DEFAULT_INDICATOR_SIZE_CLASS, indicatorSizeClassName);
  // If a caller passes a custom CSS property `--indicator-border` via the
  // `style` prop (used by extension nodes to pass their `darkerColor`),
  // expose it as an inline `borderColor` on the visible indicator so that
  // arbitrary color values (not statically known to Tailwind) are applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorBorderColor = (style as any)?.["--indicator-border"] as
    | string
    | undefined;

  return (
    <Handle
      {...props}
      isConnectable={isConnectable}
      className={cn(
        "relative border-0! bg-transparent!",
        // If callers pass width/height via classes (e.g. h-2 w-2), keep them.
        className,
        "h-[0.4rem]! w-[0.4rem]!"
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
          sizeClasses,
          shouldHighlight &&
            cn(
              // Use a thinner ring so the highlight doesn't look like a big halo.
              "ring-1",
              ringColorClass,
            ),
        )}
        // Apply computed border color when provided (extension darker color).
        style={
          indicatorBorderColor
            ? { borderColor: indicatorBorderColor }
            : undefined
        }
      />
    </Handle>
  );
}
