import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  type EdgeProps,
  useStore,
} from "@xyflow/react";

import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={mergedStyle}
      />

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
