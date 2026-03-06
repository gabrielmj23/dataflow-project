import { useCallback } from "react";
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
  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      setEdges(
        (prev) => reconnectEdge(oldEdge, connection, prev as Edge[]) as E[],
      );
    },
    [setEdges],
  );

  return {
    defaultEdgeOptions: DEFAULT_EDGE_OPTIONS,
    edgesReconnectable: true as const,
    onReconnect,
  };
}
