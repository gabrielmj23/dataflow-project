import { useCallback, useRef } from "react";
import { reconnectEdge, type Connection, type Edge } from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";

import { DEFAULT_EDGE_OPTIONS } from "@/flow/edge-appearance";

/**
 * Shared React Flow edge config used across main and embedded editors.
 * Keeps edge appearance and reconnect behavior consistent everywhere.
 */
export function useSharedEdgeConfig<E extends Edge>(
  setEdges: Dispatch<SetStateAction<E[]>>,
) {
  const reconnectAttemptRef = useRef<{
    edgeId: string;
    completed: boolean;
  } | null>(null);

  const onReconnectStart = useCallback((_: unknown, edge: Edge) => {
    reconnectAttemptRef.current = {
      edgeId: edge.id,
      completed: false,
    };
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      reconnectAttemptRef.current = {
        edgeId: oldEdge.id,
        completed: true,
      };

      setEdges(
        (prev) => reconnectEdge(oldEdge, connection, prev as Edge[]) as E[],
      );
    },
    [setEdges],
  );

  const onReconnectEnd = useCallback(
    (
      _: unknown,
      edge: Edge,
      __: unknown,
      connectionState: {
        toNode: unknown;
        toHandle: unknown;
      },
    ) => {
      const attempt = reconnectAttemptRef.current;
      const wasDroppedInAir =
        connectionState.toNode == null && connectionState.toHandle == null;

      if (
        attempt?.edgeId === edge.id &&
        !attempt.completed &&
        wasDroppedInAir
      ) {
        setEdges((prev) =>
          prev.filter((candidate) => candidate.id !== edge.id),
        );
      }

      reconnectAttemptRef.current = null;
    },
    [setEdges],
  );

  return {
    defaultEdgeOptions: DEFAULT_EDGE_OPTIONS,
    edgesReconnectable: true as const,
    onReconnect,
    onReconnectStart,
    onReconnectEnd,
  };
}
