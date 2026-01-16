import { useCallback, useRef } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import {
  buildSubflowSnapshot,
  computeBounds,
  type FlowEdge,
  type FlowNode,
  type SubflowSnapshot,
} from "@/utils/flow";
import { createNodeId } from "@/utils/id";

type UseClipboardSelectionParams = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  reactFlowInstance: ReactFlowInstance | null;
};

export function useClipboardSelection({
  nodes,
  edges,
  setNodes,
  setEdges,
  reactFlowInstance,
}: UseClipboardSelectionParams) {
  const clipboardRef = useRef<SubflowSnapshot | null>(null);
  const lastCopyBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const lastCursorFlowPosRef = useRef<{ x: number; y: number } | null>(null);

  const copySelection = useCallback(() => {
    const selectedNodesNow = nodes.filter((node) => node.selected);
    if (!selectedNodesNow.length) {
      return;
    }

    const bounds = computeBounds(selectedNodesNow);
    if (!bounds) {
      return;
    }

    const snapshot = buildSubflowSnapshot(selectedNodesNow, edges, bounds);
    clipboardRef.current = snapshot;
    lastCopyBoundsRef.current = bounds;
  }, [edges, nodes]);

  const onPaneMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!reactFlowInstance?.screenToFlowPosition) return;
      const pos = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      lastCursorFlowPosRef.current = pos;
    },
    [reactFlowInstance]
  );

  const pasteSelection = useCallback(() => {
    const snapshot = clipboardRef.current;
    if (!snapshot) {
      return;
    }

    const idMap = new Map<string, string>();
    const OFFSET = 30;

    const snapshotBounds = computeBounds(snapshot.nodes);
    const targetFromCursor = lastCursorFlowPosRef.current;
    const targetFromCopy = lastCopyBoundsRef.current
      ? {
          x: lastCopyBoundsRef.current.x + lastCopyBoundsRef.current.width / 2 + OFFSET,
          y: lastCopyBoundsRef.current.y + lastCopyBoundsRef.current.height / 2 + OFFSET,
        }
      : null;

    let targetCenter = targetFromCursor ?? targetFromCopy;

    if (!targetCenter && reactFlowInstance?.screenToFlowPosition) {
      targetCenter = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    }

    const dx =
      snapshotBounds && targetCenter
        ? targetCenter.x - (snapshotBounds.x + snapshotBounds.width / 2)
        : OFFSET;
    const dy =
      snapshotBounds && targetCenter
        ? targetCenter.y - (snapshotBounds.y + snapshotBounds.height / 2)
        : OFFSET;

    const newNodes: FlowNode[] = snapshot.nodes.map((n) => {
      const newId = createNodeId();
      idMap.set(String(n.id), newId);
      const x = (n.position?.x ?? 0) + dx;
      const y = (n.position?.y ?? 0) + dy;

      return {
        ...n,
        id: newId,
        position: {
          x,
          y,
        },
        selected: true,
      } as FlowNode;
    });

    const newEdges: FlowEdge[] = snapshot.edges.map((e) => {
      const newId = createNodeId();
      const src = String(e.source);
      const tgt = String(e.target);

      return {
        ...e,
        id: newId,
        source: idMap.get(src) ?? src,
        target: idMap.get(tgt) ?? tgt,
        selected: false,
      } as FlowEdge;
    });

    setNodes((prev) => {
      const deselected = prev.map((n) => ({
        ...n,
        selected: false,
      }));
      return [...deselected, ...newNodes];
    });

    setEdges((prev) => [...prev, ...newEdges]);
  }, [reactFlowInstance, setEdges, setNodes]);

  return { copySelection, pasteSelection, onPaneMouseMove };
}
