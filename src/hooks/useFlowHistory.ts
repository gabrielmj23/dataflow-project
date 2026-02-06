import { useCallback, useEffect, useRef, useState } from "react";
import { globalIsDragging } from "@/lib/globalRefs";
import type { FlowEdge, FlowNode } from "@/utils/flow";

type FlowSnapshot = { nodes: FlowNode[]; edges: FlowEdge[] };

type UseFlowHistoryParams = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  isRuntimeUpdateRef: React.MutableRefObject<boolean>;
};

export function useFlowHistory({
  nodes,
  edges,
  setNodes,
  setEdges,
  initialNodes,
  initialEdges,
  isRuntimeUpdateRef,
}: UseFlowHistoryParams) {
  const [, setHistory] = useState<{ stack: FlowSnapshot[]; index: number }>(
    () => ({
      stack: [{ nodes: initialNodes, edges: initialEdges }],
      index: 0,
    })
  );

  const isRestoringRef = useRef(false);
  const isDraggingRef = useRef(false);
  const historyTimeoutRef = useRef<number | null>(null);

  const pushHistorySnapshot = useCallback(
    (snapshot?: FlowSnapshot) => {
      const currentSnapshot: FlowSnapshot = snapshot ?? {
        nodes,
        edges,
      };

      setHistory((prev) => {
        const truncated = prev.stack.slice(0, prev.index + 1);
        const last = truncated[truncated.length - 1];

        if (
          last &&
          last.nodes === currentSnapshot.nodes &&
          last.edges === currentSnapshot.edges
        ) {
          return prev;
        }

        truncated.push(currentSnapshot);

        const MAX_HISTORY = 50;
        const limitedStack =
          truncated.length > MAX_HISTORY
            ? truncated.slice(truncated.length - MAX_HISTORY)
            : truncated;

        return {
          stack: limitedStack,
          index: limitedStack.length - 1,
        };
      });
    },
    [edges, nodes]
  );

  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
    globalIsDragging.current = true;
    if (historyTimeoutRef.current !== null) {
      window.clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
  }, []);

  const onNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;
    globalIsDragging.current = false;
    pushHistorySnapshot();
  }, [pushHistorySnapshot]);

  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }

    if (isRuntimeUpdateRef.current) {
      isRuntimeUpdateRef.current = false;
      return;
    }

    if (isDraggingRef.current) {
      return;
    }

    if (historyTimeoutRef.current !== null) {
      window.clearTimeout(historyTimeoutRef.current);
    }

    historyTimeoutRef.current = window.setTimeout(() => {
      pushHistorySnapshot();
    }, 200);

    return () => {
      if (historyTimeoutRef.current !== null) {
        window.clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [nodes, edges, pushHistorySnapshot, isRuntimeUpdateRef]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.index <= 0) {
        return prev;
      }

      const newIndex = prev.index - 1;
      const snapshot = prev.stack[newIndex];

      if (!snapshot) {
        return prev;
      }

      isRestoringRef.current = true;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);

      return {
        ...prev,
        index: newIndex,
      };
    });
  }, [setEdges, setNodes]);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.index >= prev.stack.length - 1) {
        return prev;
      }

      const newIndex = prev.index + 1;
      const snapshot = prev.stack[newIndex];

      if (!snapshot) {
        return prev;
      }

      isRestoringRef.current = true;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);

      return {
        ...prev,
        index: newIndex,
      };
    });
  }, [setEdges, setNodes]);

  const resetHistory = useCallback(
    (snapshot: FlowSnapshot) => {
      setHistory({
        stack: [snapshot],
        index: 0,
      });
    },
    [],
  );

  return {
    undo,
    redo,
    onNodeDragStart,
    onNodeDragStop,
    isRestoringRef,
    isDraggingRef,
    resetHistory,
  };
}
