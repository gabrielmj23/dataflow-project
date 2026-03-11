import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  type EdgeProps,
  useStore,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { subscribeEdgeValues, getEdgeLastValue } from "./edge-value-bus";
import {
  getEdgeFeedbackMode,
  subscribeEdgeFeedbackMode,
  type EdgeFeedbackMode,
} from "./edge-feedback-mode";
import { EDGE_STROKE_WIDTH } from "./edge-appearance";

type EdgeFocusState = {
  hoveredEdgeId: string | null;
  latchedEdgeIds: Set<string>;
};

const focusListeners = new Set<(state: EdgeFocusState) => void>();
let hoveredEdgeId: string | null = null;
const latchedEdgeIds = new Set<string>();
const hoverSuppressUntil = new Map<string, number>();
const HOVER_SUPPRESS_MS = 2000;
const HOVER_VISIBLE_MS = 5000;
const hoverTimeouts = new Map<string, number>();

function notifyFocusListeners() {
  const snapshot: EdgeFocusState = {
    hoveredEdgeId,
    latchedEdgeIds: new Set(latchedEdgeIds),
  };
  focusListeners.forEach((fn) => fn(snapshot));
}

function setHoveredEdge(id: string | null) {
  if (id) {
    const suppressUntil = hoverSuppressUntil.get(id);
    if (suppressUntil && suppressUntil > Date.now()) {
      return;
    }
    if (suppressUntil && suppressUntil <= Date.now()) {
      hoverSuppressUntil.delete(id);
    }
  }
  if (hoveredEdgeId === id) return;

  // clear any existing hover timeout for the previous hovered id
  if (hoveredEdgeId) {
    const prev = hoverTimeouts.get(hoveredEdgeId);
    if (prev) {
      window.clearTimeout(prev);
      hoverTimeouts.delete(hoveredEdgeId);
    }
  }

  hoveredEdgeId = id;
  notifyFocusListeners();

  // if we set a new hovered id, schedule it to clear after HOVER_VISIBLE_MS
  if (id) {
    const existing = hoverTimeouts.get(id);
    if (existing) {
      window.clearTimeout(existing);
    }
    const t = window.setTimeout(() => {
      if (hoveredEdgeId === id) {
        hoveredEdgeId = null;
        hoverTimeouts.delete(id);
        notifyFocusListeners();
      }
    }, HOVER_VISIBLE_MS);
    hoverTimeouts.set(id, t);
  }
}

function toggleLatchedEdge(id: string) {
  if (latchedEdgeIds.has(id)) {
    latchedEdgeIds.delete(id);
    suppressHoverTemporarily(id);
    if (hoveredEdgeId === id) {
      hoveredEdgeId = null;
    }
  } else {
    latchedEdgeIds.add(id);
  }
  notifyFocusListeners();
}

function clearHoveredEdge(id: string) {
  if (hoveredEdgeId === id) {
    hoveredEdgeId = null;
    const t = hoverTimeouts.get(id);
    if (t) {
      window.clearTimeout(t);
      hoverTimeouts.delete(id);
    }
    notifyFocusListeners();
  }
}

function clearLatchedEdge(id: string) {
  if (latchedEdgeIds.delete(id)) {
    notifyFocusListeners();
  }
}

function subscribeEdgeFocus(listener: (state: EdgeFocusState) => void) {
  focusListeners.add(listener);
  listener({ hoveredEdgeId, latchedEdgeIds: new Set(latchedEdgeIds) });
  return () => focusListeners.delete(listener);
}

function suppressHoverTemporarily(id: string) {
  const expiry = Date.now() + HOVER_SUPPRESS_MS;
  hoverSuppressUntil.set(id, expiry);
  window.setTimeout(() => {
    if (hoverSuppressUntil.get(id) === expiry) {
      hoverSuppressUntil.delete(id);
      notifyFocusListeners();
    }
  }, HOVER_SUPPRESS_MS);
}

function isHoverSuppressed(id: string): boolean {
  const until = hoverSuppressUntil.get(id);
  if (!until) return false;
  if (until <= Date.now()) {
    hoverSuppressUntil.delete(id);
    return false;
  }
  return true;
}

import { getPortTypeMask, maskToVisualPortDataType } from "./port-data-type";

function getSwitchEdgeLabel(params: {
  sourceNode: unknown;
  sourceHandleId: string | null | undefined;
}): string | null {
  void params;
  return null;
}

function getDesvioEdgeLabel(params: {
  sourceNode: unknown;
  sourceHandleId: string | null | undefined;
}): string | null {
  void params;
  return null;
}

function getSequenceEdgeLabel(params: { targetNode: unknown }): string | null {
  const { targetNode } = params;
  if (!targetNode || typeof targetNode !== "object") return null;
  const type = (targetNode as { type?: unknown }).type;

  // Apply the same labels to both sequence and pulseSequence nodes.
  if (type !== "sequence" && type !== "pulseSequence") return null;

  return null;
}

function getTextTransformEdgeLabel(params: {
  targetNode: unknown;
}): string | null {
  const { targetNode } = params;
  if (!targetNode || typeof targetNode !== "object") return null;
  const type = (targetNode as { type?: unknown }).type;

  if (type !== "replaceText" && type !== "subtractText" && type !== "sliceText")
    return null;
  return null;
}

/**
 * Default edge renderer that adds labels for Switch outputs.
 *
 * - For edges whose source node is a Switch:
 *   - `out-N` edges show the condition label (or a derived description)
 */
export function LabeledEdge(props: EdgeProps) {
  const { id, source, target, markerEnd, style, selected } = props;

  const sourceHandleId = props.sourceHandleId;
  const targetHandleId = props.targetHandleId;

  const nodeLookup = useStore(
    (state) => (state as unknown as { nodeLookup: unknown }).nodeLookup,
  );

  const sourceNode =
    nodeLookup &&
    typeof nodeLookup === "object" &&
    "get" in (nodeLookup as Record<string, unknown>) &&
    typeof (nodeLookup as { get?: unknown }).get === "function"
      ? (nodeLookup as { get: (id: string) => unknown }).get(String(source))
      : null;

  const targetNode =
    nodeLookup &&
    typeof nodeLookup === "object" &&
    "get" in (nodeLookup as Record<string, unknown>) &&
    typeof (nodeLookup as { get?: unknown }).get === "function"
      ? (nodeLookup as { get: (id: string) => unknown }).get(String(target))
      : null;

  const sourceNodeType =
    sourceNode && typeof sourceNode === "object"
      ? ((sourceNode as { type?: unknown }).type as unknown)
      : null;

  const visualType = maskToVisualPortDataType(
    getPortTypeMask({
      nodeType: typeof sourceNodeType === "string" ? sourceNodeType : null,
      handleType: "source",
      handleId: sourceHandleId ?? null,
    }),
  );

  const strokeWidth =
    typeof style?.strokeWidth === "number" ||
    typeof style?.strokeWidth === "string"
      ? style.strokeWidth
      : EDGE_STROKE_WIDTH;

  const mergedStyle = {
    ...(style ?? {}),
    strokeWidth,
    // Force all edges to be solid.
    strokeDasharray: "none",
    strokeDashoffset: 0,
  };

  const label =
    getSwitchEdgeLabel({ sourceNode, sourceHandleId }) ??
    getDesvioEdgeLabel({ sourceNode, sourceHandleId }) ??
    getSequenceEdgeLabel({ targetNode }) ??
    getTextTransformEdgeLabel({ targetNode });

  const useStraight =
    Boolean(props.data) &&
    typeof props.data === "object" &&
    (props.data as { edgeType?: unknown }).edgeType === "straight";

  const [edgePath, labelX, labelY] = useStraight
    ? getStraightPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
      })
    : getBezierPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        sourcePosition: props.sourcePosition,
        targetX: props.targetX,
        targetY: props.targetY,
        targetPosition: props.targetPosition,
      });

  // For straight edges the label coordinates returned by the helper may
  // place the label slightly above the line. Compute a true midpoint for
  // straight edges so the bubble sits centered on the connection.
  // Always compute label coordinates using Bezier helper like the docs do.
  // For straight edges we still render the straight `edgePath`, but use
  // the Bezier math to obtain a stable center point that stays centered
  // when the edge moves.
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  const overlayX = labelX;
  const overlayY = labelY;

  return (
    <>
      <g
        onMouseEnter={() => setHoveredEdge(id)}
        onClick={() => toggleLatchedEdge(id)}
        style={{ cursor: "pointer" }}
      >
        <path
          d={edgePath}
          stroke="rgba(0,0,0,0.001)"
          strokeWidth={24}
          fill="none"
          pointerEvents="stroke"
        />
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={mergedStyle}
        />
      </g>

      {/* Transient bubble & hover tooltip for edge value */}
      <EdgeLabelRenderer>
        <EdgeValueOverlay id={String(id)} x={overlayX} y={overlayY} />
      </EdgeLabelRenderer>

      {label && (
        <EdgeLabelRenderer>
          <div
            className={
              "pointer-events-none absolute rounded-md border bg-background px-2 py-0.5 text-xs text-foreground shadow-sm"
            }
            style={{
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY}px)`,
              opacity: selected ? 1 : 0.95,
            }}
            data-edge-label-for={id}
            data-edge-source={source}
            data-edge-source-handle={sourceHandleId ?? ""}
            data-edge-target={target}
            data-edge-target-handle={targetHandleId ?? ""}
            data-edge-type={visualType}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Verdadero" : "Falso";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const TRANSIENT_VISIBLE_MS = 4300;
const FADE_MS = 200;
const TRANSIENT_TRUNCATE_CHARS = 15;

function truncateTransientValue(text: string): string {
  if (text.length <= TRANSIENT_TRUNCATE_CHARS) return text;
  return `${text.slice(0, TRANSIENT_TRUNCATE_CHARS)}...`;
}

function EdgeValueOverlay({ id, x, y }: { id: string; x: number; y: number }) {
  const [transient, setTransient] = useState<unknown | null>(null);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<EdgeFeedbackMode>(getEdgeFeedbackMode());
  const [focusState, setFocusState] = useState<EdgeFocusState>(() => ({
    hoveredEdgeId: null,
    latchedEdgeIds: new Set<string>(),
  }));
  const lastSnapshot = useMemo(
    () => getEdgeLastValue(String(id)),
    [id, version, transient],
  );

  const left = Math.round(x);
  const top = Math.round(y);

  useEffect(() => {
    const unsub = subscribeEdgeFeedbackMode(setMode);
    return () => {
      // call unsubscribe and ignore its boolean return value
      unsub();
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeEdgeFocus((state) =>
      setFocusState({
        hoveredEdgeId: state.hoveredEdgeId,
        latchedEdgeIds: new Set(state.latchedEdgeIds),
      }),
    );
    return () => {
      unsub();
    };
  }, []);

  useEffect(
    () => () => {
      clearHoveredEdge(id);
      clearLatchedEdge(id);
    },
    [id],
  );

  useEffect(() => {
    let timeoutId: number | null = null;
    const unsub = subscribeEdgeValues((event) => {
      if (event.kind === "reset") {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
        setTransient(null);
        setVersion((v) => v + 1);
        return;
      }

      if (String(event.edgeId) !== String(id)) return;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      setTransient(event.value);
      setVersion((v) => v + 1);

      timeoutId = window.setTimeout(
        () => setTransient(null),
        TRANSIENT_VISIBLE_MS,
      );
    });

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      unsub();
    };
  }, [id]);

  const isHovered = focusState.hoveredEdgeId === id && !isHoverSuppressed(id);
  const isLatched = focusState.latchedEdgeIds.has(id);

  type BubbleVariant = "latched" | "persistent" | "transient" | "hover" | null;
  let variant: BubbleVariant = null;
  let bubbleValue: string | null = null;

  if (isLatched && lastSnapshot) {
    variant = "latched";
    bubbleValue = formatValue(lastSnapshot.value);
  } else if (mode === "persistent" && lastSnapshot) {
    variant = "persistent";
    bubbleValue = formatValue(lastSnapshot.value);
  } else if (
    mode === "transient" &&
    transient !== null &&
    transient !== undefined &&
    !isLatched
  ) {
    variant = "transient";
    bubbleValue = formatValue(transient);
  } else if (mode === "transient" && isHovered && lastSnapshot && !isLatched) {
    variant = "hover";
    bubbleValue = formatValue(lastSnapshot.value);
  }

  const displayBubbleValue =
    variant === "transient" && bubbleValue
      ? truncateTransientValue(bubbleValue)
      : bubbleValue;

  // Manage mount/unmount to allow fade-out animation when the bubble disappears.
  const [mounted, setMounted] = useState<boolean>(
    () => !!variant && !!bubbleValue,
  );
  const [visible, setVisible] = useState<boolean>(
    () => !!variant && !!bubbleValue,
  );
  const [renderValue, setRenderValue] = useState<string | null>(
    () => displayBubbleValue ?? null,
  );

  useEffect(() => {
    // When a new variant/value appears, ensure we mount and show it.
    if (variant && displayBubbleValue) {
      setRenderValue(displayBubbleValue);
      setMounted(true);
      // small delay to allow mount before setting visible so transition runs
      window.setTimeout(() => setVisible(true), 10);
      return;
    }

    // When variant/value becomes null, trigger hide animation then unmount.
    if (mounted) {
      setVisible(false);
      const t = window.setTimeout(() => {
        setMounted(false);
        setRenderValue(null);
      }, FADE_MS);
      return () => window.clearTimeout(t);
    }
  }, [variant, displayBubbleValue]);

  // If nothing to render (not mounted), show the small invisible hit area like before.
  if (!mounted) {
    return (
      <div
        className="button-edge__label nodrag nopan absolute"
        onMouseEnter={() => setHoveredEdge(id)}
        onClick={() => toggleLatchedEdge(id)}
        style={{
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "auto",
          zIndex: 10,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
        }}
      />
    );
  }

  const animStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    width: "auto",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    fontWeight: "normal",
    lineHeight: 1,
    letterSpacing: "normal",
    transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
    opacity: visible ? (variant === "hover" ? 0.85 : 1) : 0,
    transform: visible
      ? "translateY(0) scale(1)"
      : "translateY(-4px) scale(0.96)",
  };

  return (
    <div
      className="button-edge__label nodrag nopan absolute"
      onMouseEnter={() => setHoveredEdge(id)}
      onClick={() => toggleLatchedEdge(id)}
      style={{
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "auto",
        zIndex: 10,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "auto",
        height: "auto",
      }}
    >
      <div
        className="pointer-events-none rounded-full nodi-blue px-2 py-0.5 text-xs shadow-sm"
        style={animStyle}
      >
        {renderValue}
      </div>
    </div>
  );
}
