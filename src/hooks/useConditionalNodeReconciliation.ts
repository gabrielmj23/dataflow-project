import { useEffect } from "react";
import type { FlowEdge, FlowNode } from "@/utils/flow";
import { reconcileConditionalGraph } from "@/utils/flow";

type UseConditionalNodeReconciliationParams = {
  edges: FlowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  isRestoringRef: React.MutableRefObject<boolean>;
  isRuntimeUpdateRef: React.MutableRefObject<boolean>;
  isDraggingRef: React.MutableRefObject<boolean>;
};

export function useConditionalNodeReconciliation({
  edges,
  setNodes,
  setEdges,
  isRestoringRef,
  isRuntimeUpdateRef,
  isDraggingRef,
}: UseConditionalNodeReconciliationParams) {
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (isRuntimeUpdateRef.current) return;
    if (isDraggingRef.current) return;

    setNodes((prevNodes) => {
      const result = reconcileConditionalGraph(prevNodes, edges);
      if (result.changedEdges) {
        setEdges(result.edges);
      }
      return result.changedNodes ? result.nodes : prevNodes;
    });
  }, [edges, isDraggingRef, isRestoringRef, isRuntimeUpdateRef, setEdges, setNodes]);
}
