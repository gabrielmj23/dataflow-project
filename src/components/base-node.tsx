import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";
import { useNodeId, useReactFlow } from "@xyflow/react";

import NodeSettingsButton from "@/components/ui/node-settings-button";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  /** Optional handler to open the node configuration dialog. */
  onConfigClick?: (() => void) | null;
  /** Optional handler to delete the node. Defaults to removing the current node. */
  onDelete?: (() => void) | null;
  /** Hide the delete button (mostly for embedded previews). */
  hideDeleteButton?: boolean;
  selected?: boolean;
  /** Optional extra actions shown on hover (right side). */
  sideActions?: ReactNode;
  /** Optional class override for side actions container positioning. */
  sideActionsClassName?: string;
};

export function BaseNode({
  className,
  hideRuntimeBadges,
  disableRuntimeStyles,
  runtimeError,
  onConfigClick,
  onDelete,
  hideDeleteButton,
  sideActions,
  sideActionsClassName,
  ...props
}: BaseNodeProps) {
  const hasErrorTooltip = Boolean(runtimeError) && !disableRuntimeStyles;
  const nodeId = useNodeId?.();
  const { deleteElements } = useReactFlow();
  const [actionsVisible, setActionsVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const showActions = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setActionsVisible(true);
  }, []);

  const hideActionsLater = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(
      () => setActionsVisible(false),
      1000,
    );
  }, []);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete();
      return;
    }
    if (!nodeId) return;
    deleteElements({ nodes: [{ id: nodeId }] });
  }, [deleteElements, nodeId, onDelete]);

  const content = (
    <div
      className={cn(
        // Inner node container; when runtime styles are disabled we skip the
        // `rf-node-inner` class so global runtime CSS won't touch it.
        disableRuntimeStyles ? "" : "rf-node-inner",
        "group bg-card text-card-foreground relative rounded-md border border-border",
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
      onMouseEnter={(e) => {
        showActions();
        if (props.onMouseEnter) props.onMouseEnter(e);
      }}
      onMouseLeave={(e) => {
        hideActionsLater();
        if (props.onMouseLeave) props.onMouseLeave(e);
      }}
      onFocus={(e) => {
        showActions();
        if (props.onFocus) props.onFocus(e);
      }}
      onBlur={(e) => {
        hideActionsLater();
        if (props.onBlur) props.onBlur(e);
      }}
      {...props}
    >
      {(Boolean(onConfigClick) || !hideDeleteButton) && (
        <div
          className={cn(
            "absolute -top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1",
            // translucent white background with slight blur like the console
            "bg-white/70 backdrop-blur-sm rounded-md  border border-white/30",
            "transition-opacity duration-150",
            actionsVisible
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none",
          )}
        >
          {onConfigClick && (
            <NodeSettingsButton
              onClick={onConfigClick}
              className="pointer-events-auto"
            />
          )}

          {!hideDeleteButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-node"
                  variant="node"
                  aria-label="Eliminar"
                  className="pointer-events-auto opacity-100 bg-transparent shadow-none p-1 text-(--node-action-color)"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDelete();
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                Eliminar
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {sideActions && (
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1",
            // translucent white background with slight blur like the console
            "bg-white/70 backdrop-blur-sm rounded-md border border-white/30",
            "transition-opacity duration-150",
            actionsVisible
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none",
            sideActionsClassName,
          )}
        >
          {sideActions}
        </div>
      )}

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
