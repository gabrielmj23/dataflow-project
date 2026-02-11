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

import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "./port-data-type";

type SwitchCondition = {
  label?: string;
  operator?: unknown;
  target?: unknown;
};

function parseOutIndex(handleId: string | null | undefined): number | null {
  if (!handleId) return null;
  const match = /^out-(\d+)$/.exec(handleId);
  if (!match) return null;
  const idx = Number(match[1]);
  return Number.isFinite(idx) ? idx : null;
}

function describeCondition(condition: SwitchCondition): string {
  const label =
    typeof condition.label === "string" ? condition.label.trim() : "";
  if (label) return label;

  const op = condition.operator;
  const target =
    typeof condition.target === "string"
      ? condition.target
      : String(condition.target ?? "");

  switch (op) {
    case "truthy":
      return "Verdadero";
    case "falsy":
      return "Falso";
    case "contains":
      return `Contiene ${target}`;
    case "startsWith":
      return `Inicia con ${target}`;
    case "endsWith":
      return `Termina con ${target}`;
    case "==":
    case "!=":
    case ">":
    case ">=":
    case "<":
    case "<=":
      return `${String(op)} ${target}`;
    default:
      return "Condición";
  }
}

function getSwitchEdgeLabel(params: {
  sourceNode: unknown;
  sourceHandleId: string | null | undefined;
}): string | null {
  const { sourceNode, sourceHandleId } = params;

  if (!sourceNode || typeof sourceNode !== "object") return null;
  const type = (sourceNode as { type?: unknown }).type;
  if (type !== "switch") return null;

  const idx = parseOutIndex(sourceHandleId);
  if (!idx) return null;

  const data = (sourceNode as { data?: unknown }).data;
  const conditionsRaw =
    data && typeof data === "object"
      ? (data as { conditions?: unknown }).conditions
      : undefined;

  if (!Array.isArray(conditionsRaw)) return `Salida ${idx}`;
  const cond = conditionsRaw[idx - 1] as unknown;
  if (!cond || typeof cond !== "object") return `Salida ${idx}`;

  return describeCondition(cond as SwitchCondition);
}

function getSequenceEdgeLabel(params: {
  targetNode: unknown;
  targetHandleId: string | null | undefined;
}): string | null {
  const { targetNode, targetHandleId } = params;
  if (!targetNode || typeof targetNode !== "object") return null;
  const type = (targetNode as { type?: unknown }).type;

  // Apply the same labels to both sequence and pulseSequence nodes.
  if (type !== "sequence" && type !== "pulseSequence") return null;

  switch (targetHandleId) {
    case "in-1":
      return "Inicio";
    case "in-2":
      return "Fin";
    case "in-3":
      return "Paso";
    default:
      return null;
  }
}

function getTextTransformEdgeLabel(params: {
  targetNode: unknown;
  targetHandleId: string | null | undefined;
}): string | null {
  const { targetNode, targetHandleId } = params;
  if (!targetNode || typeof targetNode !== "object") return null;
  const type = (targetNode as { type?: unknown }).type;

  if (type !== "replaceText" && type !== "subtractText" && type !== "sliceText") return null;

  if (targetHandleId === "in-1") return "Texto";
  if (targetHandleId === "in-2") {
    if (type === "replaceText") return "Buscar";
    if (type === "subtractText") return "Eliminar";
    if (type === "sliceText") return "Inicio";
  }
  if (targetHandleId === "in-3") {
    if (type === "replaceText") return "Nuevo";
    if (type === "sliceText") return "Fin";
  }

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
    (state) => (state as unknown as { nodeLookup: unknown }).nodeLookup
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
    })
  );

  const mergedStyle = {
    ...(style ?? {}),
    // Force all edges to be solid.
    strokeDasharray: "none",
    strokeDashoffset: 0,
  };

  const label =
    getSwitchEdgeLabel({ sourceNode, sourceHandleId }) ??
    getSequenceEdgeLabel({ targetNode, targetHandleId }) ??
    getTextTransformEdgeLabel({ targetNode, targetHandleId });

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
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Verdadero" : "Falso";
  return String(value);
}

const TRANSIENT_VISIBLE_MS = 4300;

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
    [id, version, transient]
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
      })
    );
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => () => {
    clearHoveredEdge(id);
    clearLatchedEdge(id);
  }, [id]);

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
        TRANSIENT_VISIBLE_MS
      );
    });

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      unsub();
    };
  }, [id]);

  const isHovered =
    focusState.hoveredEdgeId === id && !isHoverSuppressed(id);
  const isLatched = focusState.latchedEdgeIds.has(id);

  type BubbleVariant =
    | "latched"
    | "persistent"
    | "transient"
    | "hover"
    | null;
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

  if (!variant || !bubbleValue) {
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
        style={{
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
          opacity: variant === "hover" ? 0.85 : 1,
          transition: "opacity 160ms ease",
        }}
      >
        {bubbleValue}
      </div>
    </div>
  );
}
