import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  SetStateAction,
} from "react";
import type { Edge, Node } from "@xyflow/react";

type DragStopEvent =
  | ReactMouseEvent<Element, MouseEvent>
  | MouseEvent
  | TouchEvent;

type ViewportReader = {
  getViewport: () => { x: number; y: number; zoom: number };
};

type DeleteDraggedNodesOutsideViewportParams<
  TNode extends Node,
  TEdge extends Edge,
> = {
  event: DragStopEvent;
  draggedNodes: TNode[];
  reactFlowInstance: ViewportReader | null;
  setNodes: Dispatch<SetStateAction<TNode[]>>;
  setEdges: Dispatch<SetStateAction<TEdge[]>>;
  viewportElement?: HTMLElement | null;
  marginPx?: number;
};

type NodeWithOptionalLayout = Node & {
  measured?: { width?: number; height?: number };
  positionAbsolute?: { x: number; y: number };
};

function isNodeLocked(node: Node): boolean {
  const data = (node.data ?? {}) as { locked?: unknown };
  return data.locked === true || node.deletable === false;
}

function getNodeSize(node: NodeWithOptionalLayout): {
  width: number;
  height: number;
} {
  const rawWidth = node.measured?.width ?? node.width ?? 0;
  const rawHeight = node.measured?.height ?? node.height ?? 0;

  const width = Number.isFinite(rawWidth) ? Math.max(0, rawWidth) : 0;
  const height = Number.isFinite(rawHeight) ? Math.max(0, rawHeight) : 0;

  return { width, height };
}

function getNodePosition(node: NodeWithOptionalLayout): {
  x: number;
  y: number;
} {
  return node.positionAbsolute ?? node.position;
}

function resolveReactFlowElement(event: DragStopEvent): HTMLElement | null {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  const flowElement = target.closest(".react-flow");
  if (!(flowElement instanceof HTMLElement)) {
    return null;
  }

  return flowElement;
}

function extractPointerClientPosition(
  event: DragStopEvent,
): { x: number; y: number } | null {
  if (
    "changedTouches" in event &&
    Array.isArray(event.changedTouches) &&
    event.changedTouches.length > 0
  ) {
    const touch = event.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }

  if (
    "touches" in event &&
    Array.isArray(event.touches) &&
    event.touches.length > 0
  ) {
    const touch = event.touches[0];
    return { x: touch.clientX, y: touch.clientY };
  }

  if (
    "clientX" in event &&
    typeof event.clientX === "number" &&
    typeof event.clientY === "number"
  ) {
    return { x: event.clientX, y: event.clientY };
  }

  return null;
}

export function deleteDraggedNodesOutsideViewport<
  TNode extends Node,
  TEdge extends Edge,
>({
  event,
  draggedNodes,
  reactFlowInstance,
  setNodes,
  setEdges,
  viewportElement,
  marginPx = 8,
}: DeleteDraggedNodesOutsideViewportParams<TNode, TEdge>): string[] {
  if (!reactFlowInstance || draggedNodes.length === 0) {
    return [];
  }

  const flowElement = viewportElement ?? resolveReactFlowElement(event);
  if (!flowElement) {
    return [];
  }

  const safeMargin = Math.max(0, marginPx);
  const pointer = extractPointerClientPosition(event);
  if (pointer) {
    const rect = flowElement.getBoundingClientRect();
    const isPointerOutsideViewport =
      pointer.x < rect.left - safeMargin ||
      pointer.x > rect.right + safeMargin ||
      pointer.y < rect.top - safeMargin ||
      pointer.y > rect.bottom + safeMargin;

    if (isPointerOutsideViewport) {
      const idsToDelete = new Set<string>();
      for (const node of draggedNodes) {
        if (!isNodeLocked(node)) {
          idsToDelete.add(String(node.id));
        }
      }

      if (idsToDelete.size === 0) {
        return [];
      }

      setNodes((prev) =>
        prev.filter((node) => !idsToDelete.has(String(node.id))),
      );
      setEdges((prev) =>
        prev.filter(
          (edge) =>
            !idsToDelete.has(String(edge.source)) &&
            !idsToDelete.has(String(edge.target)),
        ),
      );

      return Array.from(idsToDelete);
    }
  }

  const viewportWidth = flowElement.clientWidth;
  const viewportHeight = flowElement.clientHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return [];
  }

  const viewport = reactFlowInstance.getViewport();
  const leftLimit = -safeMargin;
  const topLimit = -safeMargin;
  const rightLimit = viewportWidth + safeMargin;
  const bottomLimit = viewportHeight + safeMargin;

  const idsToDelete = new Set<string>();

  for (const node of draggedNodes) {
    if (isNodeLocked(node)) {
      continue;
    }

    const layoutNode = node as NodeWithOptionalLayout;
    const position = getNodePosition(layoutNode);
    const size = getNodeSize(layoutNode);

    const nodeLeft = position.x * viewport.zoom + viewport.x;
    const nodeTop = position.y * viewport.zoom + viewport.y;
    const nodeRight = nodeLeft + size.width * viewport.zoom;
    const nodeBottom = nodeTop + size.height * viewport.zoom;

    const hasSize = size.width > 0 || size.height > 0;

    const isOutside = hasSize
      ? nodeRight < leftLimit ||
        nodeLeft > rightLimit ||
        nodeBottom < topLimit ||
        nodeTop > bottomLimit
      : nodeLeft < leftLimit ||
        nodeLeft > rightLimit ||
        nodeTop < topLimit ||
        nodeTop > bottomLimit;

    if (isOutside) {
      idsToDelete.add(String(node.id));
    }
  }

  if (idsToDelete.size === 0) {
    return [];
  }

  setNodes((prev) => prev.filter((node) => !idsToDelete.has(String(node.id))));
  setEdges((prev) =>
    prev.filter(
      (edge) =>
        !idsToDelete.has(String(edge.source)) &&
        !idsToDelete.has(String(edge.target)),
    ),
  );

  return Array.from(idsToDelete);
}
