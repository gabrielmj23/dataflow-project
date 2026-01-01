import type { ComponentProps } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
type BaseNodeProps = ComponentProps<"div"> & {
  hideRuntimeBadges?: boolean;
  /**
   * When true, disables visual runtime state styles (borders/halos).
   * Used for constant/input nodes so they don't show execution state.
   */
  disableRuntimeStyles?: boolean;
  /** Optional runtime error message to show in a tooltip when the node fails. */
  runtimeError?: string | null;
};

export function BaseNode({
  className,
  hideRuntimeBadges,
  disableRuntimeStyles,
  runtimeError,
  ...props
}: BaseNodeProps) {
  const hasErrorTooltip = Boolean(runtimeError) && !disableRuntimeStyles;

  const content = (
    <div
      className={cn(
        // Inner node container; when runtime styles are disabled we skip the
        // `rf-node-inner` class so global runtime CSS won't touch it.
        disableRuntimeStyles ? "" : "rf-node-inner",
        "bg-card text-card-foreground relative rounded-md border border-border",
        "hover:ring-1",
        // React Flow displays node elements inside of a `NodeWrapper` component,
        // which compiles down to a div with the class `react-flow__node`.
        // When a node is selected, the class `selected` is added to the
        // `react-flow__node` element. This allows us to style the node when it
        // is selected, using Tailwind's `&` selector.
        "[.react-flow\\_\\_node.selected_&]:border-muted-foreground",
        "[.react-flow\\_\\_node.selected_&]:shadow-lg",
        className,
      )}
      tabIndex={0}
      {...props}
    >
      {!hideRuntimeBadges && (
        <span className="rf-runtime-badge rf-runtime-running pointer-events-none absolute top-1 left-1 hidden select-none rounded bg-background/80 px-1 py-0.5 text-[10px] leading-none text-foreground">
          <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-r-transparent" />
        </span>
      )}
      {props.children}
    </div>
  );

  if (!hasErrorTooltip) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="text-red-600">
        {`Error: ${runtimeError ?? ""}`}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A container for a consistent header layout intended to be used inside the
 * `<BaseNode />` component.
 */
export function BaseNodeHeader({
  className,
  ...props
}: ComponentProps<"header">) {
  return (
    <header
      {...props}
      className={cn(
        "mx-0 my-0 -mb-1 flex flex-row items-center justify-between gap-2 px-3 py-2",
        // Remove or modify these classes if you modify the padding in the
        // `<BaseNode />` component.
        className,
      )}
    />
  );
}

/**
 * The title text for the node. To maintain a native application feel, the title
 * text is not selectable.
 */
export function BaseNodeHeaderTitle({
  className,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="base-node-title"
      className={cn("user-select-none flex-1 font-semibold", className)}
      {...props}
    />
  );
}

export function BaseNodeContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="base-node-content"
      className={cn("flex flex-col gap-y-2 p-3", className)}
      {...props}
    />
  );
}

export function BaseNodeFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="base-node-footer"
      className={cn(
        "flex flex-col items-center gap-y-2 border-t px-3 pt-2 pb-3",
        className,
      )}
      {...props}
    />
  );
}
