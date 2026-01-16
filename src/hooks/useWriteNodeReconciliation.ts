import { useEffect } from "react";
import type { FlowEdge, FlowNode } from "@/utils/flow";
import { reconcileWriteGraph } from "@/utils/flow";

type UseWriteNodeReconciliationParams = {
  edges: FlowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  isRestoringRef: React.MutableRefObject<boolean>;
  isRuntimeUpdateRef: React.MutableRefObject<boolean>;
  isDraggingRef: React.MutableRefObject<boolean>;
};

export function useWriteNodeReconciliation({
  edges,
  setNodes,
  setEdges,
  isRestoringRef,
  isRuntimeUpdateRef,
  isDraggingRef,
}: UseWriteNodeReconciliationParams) {
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (isRuntimeUpdateRef.current) return;
    if (isDraggingRef.current) return;

    setNodes((prevNodes) => {
      const result = reconcileWriteGraph(prevNodes, edges);
      if (result.changedEdges) {
        setEdges(result.edges);
      }
      return result.changedNodes ? result.nodes : prevNodes;
    });
  }, [edges, isDraggingRef, isRestoringRef, isRuntimeUpdateRef, setEdges, setNodes]);
}
