import { useCallback } from "react";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type { FlowEdge, FlowNode } from "@/utils/flow";

interface UseNodeEdgeHandlersParams {
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
}

/**
 * Encapsulates the `onNodesChange` / `onEdgesChange` callbacks that ReactFlow
 * needs, including:
 * - Preventing deletion of locked / non-deletable nodes and edges.
 * - Cascading removal of paired nodes (e.g. conditional ↔ selector).
 * - Keeping paired node positions in sync when one is dragged.
 */
export function useNodeEdgeHandlers({
  setNodes,
  setEdges,
}: UseNodeEdgeHandlersParams) {
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nodesSnapshot) => {
        // Identify locked / non-deletable nodes
        const lockedNodeIds = new Set(
          nodesSnapshot
            .filter((node) => {
              const data =
                node.data && typeof node.data === "object"
                  ? (node.data as Record<string, unknown>)
                  : null;
              return data?.locked === true || node.deletable === false;
            })
            .map((node) => String(node.id)),
        );

        // Filter out remove-changes that target locked nodes
        const filteredChanges = changes.filter((change) => {
          if (change.type !== "remove") return true;
          return !lockedNodeIds.has(String(change.id));
        });

        // Cascade removal to paired nodes
        const removedChanges = filteredChanges.filter(
          (change) => change.type === "remove",
        );
        let expandedChanges = filteredChanges;

        if (removedChanges.length > 0) {
          const removedIds = new Set(
            removedChanges.map((change) => String(change.id)),
          );
          const removedPairIds = new Set<string>();

          for (const node of nodesSnapshot) {
            const nodeId = String(node.id);
            if (!removedIds.has(nodeId)) continue;

            const data =
              node.data && typeof node.data === "object"
                ? (node.data as Record<string, unknown>)
                : null;
            const pairId = data?.pairId ? String(data.pairId) : null;
            if (pairId) removedPairIds.add(pairId);
          }

          if (removedPairIds.size > 0) {
            for (const node of nodesSnapshot) {
              const data =
                node.data && typeof node.data === "object"
                  ? (node.data as Record<string, unknown>)
                  : null;
              const pairId = data?.pairId ? String(data.pairId) : null;
              if (pairId && removedPairIds.has(pairId)) {
                removedIds.add(String(node.id));
              }
            }

            expandedChanges = filteredChanges.concat(
              Array.from(removedIds)
                .filter(
                  (id) => !removedChanges.some((c) => String(c.id) === id),
                )
                .map((id) => ({ type: "remove", id }) as NodeChange),
            );

            // Also remove edges connected to paired nodes
            setEdges((edgesSnapshot) =>
              edgesSnapshot.filter((edge) => {
                const data =
                  edge.data && typeof edge.data === "object"
                    ? (edge.data as Record<string, unknown>)
                    : null;
                const edgePairId = data?.pairId ? String(data.pairId) : null;
                if (edgePairId && removedPairIds.has(edgePairId)) return false;
                if (
                  removedIds.has(String(edge.source)) ||
                  removedIds.has(String(edge.target))
                ) {
                  return false;
                }
                return true;
              }),
            );
          }
        }

        const next = applyNodeChanges(expandedChanges, nodesSnapshot);

        // Sync paired-node positions
        const movedIds = new Set(
          expandedChanges
            .filter((change) => change.type === "position")
            .map((change) => String(change.id)),
        );

        if (movedIds.size === 0) return next;

        const pairs = new Map<
          string,
          { conditional?: FlowNode; selector?: FlowNode; offset: number }
        >();

        for (const node of next) {
          const data =
            node.data && typeof node.data === "object"
              ? (node.data as Record<string, unknown>)
              : null;
          const pairId = data?.pairId ? String(data.pairId) : null;
          if (!pairId) continue;

          const role = data?.pairRole ? String(data.pairRole) : null;
          const offsetRaw = data?.pairOffsetY;
          const offset = Number.isFinite(Number(offsetRaw))
            ? Number(offsetRaw)
            : 160;

          const entry = pairs.get(pairId) ?? { offset };
          entry.offset = offset;
          if (role === "conditional") entry.conditional = node;
          if (role === "selector") entry.selector = node;
          pairs.set(pairId, entry);
        }

        if (pairs.size === 0) return next;

        const overrides = new Map<string, { x: number; y: number }>();

        for (const [, pair] of pairs.entries()) {
          const conditional = pair.conditional;
          const selector = pair.selector;
          if (!conditional || !selector) continue;

          const conditionalMoved = movedIds.has(String(conditional.id));
          const selectorMoved = movedIds.has(String(selector.id));
          if (!conditionalMoved && !selectorMoved) continue;

          const offset = pair.offset;

          if (conditionalMoved) {
            overrides.set(String(selector.id), {
              x: conditional.position.x,
              y: conditional.position.y + offset,
            });
          } else if (selectorMoved) {
            overrides.set(String(conditional.id), {
              x: selector.position.x,
              y: selector.position.y - offset,
            });
          }
        }

        if (overrides.size === 0) return next;

        return next.map((node) => {
          const nextPos = overrides.get(String(node.id));
          if (!nextPos) return node;
          return { ...node, position: nextPos } as FlowNode;
        });
      });
    },
    [setNodes, setEdges],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => {
        const lockedEdgeIds = new Set(
          edgesSnapshot
            .filter(
              (edge) =>
                edge.data &&
                typeof edge.data === "object" &&
                (edge.data as { locked?: unknown }).locked === true,
            )
            .map((edge) => String(edge.id)),
        );

        const filteredChanges = changes.filter((change) => {
          if (change.type !== "remove") return true;
          return !lockedEdgeIds.has(String(change.id));
        });

        return applyEdgeChanges(filteredChanges, edgesSnapshot);
      }),
    [setEdges],
  );

  return { onNodesChange, onEdgesChange };
}
