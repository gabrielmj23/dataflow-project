import { useCallback, useState } from "react";
import type { Connection, Edge } from "@xyflow/react";
import { validateConnection } from "@/flow/connection-validation";
import { getPortTypeMask } from "@/flow/port-data-type";
import { useConnectionValidationTooltip } from "@/flow/use-connection-validation-tooltip";
import type { ConnectionHighlightState } from "@/flow/connection-highlight-context";
import { createNodeId } from "@/utils/id";
import type { FlowNode } from "@/utils/flow";
import { playClick } from "@/lib/sound";

type UseConnectionsParams = {
  nodes: FlowNode[];
  setNodes?: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
};

export function useConnections({ nodes, setEdges }: UseConnectionsParams) {
  const connectionTooltip = useConnectionValidationTooltip(nodes);
  const [connectionHighlight, setConnectionHighlight] =
    useState<ConnectionHighlightState>(null);

  const onConnectStart = useCallback(
    (
      event: MouseEvent | TouchEvent,
      params: {
        nodeId?: string | null;
        handleType?: string | null;
        handleId?: string | null;
      },
    ) => {
      // Keep existing tooltip behavior.
      connectionTooltip.onConnectStart(event, params as never);

      if (!params.nodeId) {
        setConnectionHighlight(null);
        return;
      }

      if (params.handleType !== "source") {
        setConnectionHighlight(null);
        return;
      }

      const sourceNode = nodes.find(
        (n) => String(n.id) === String(params.nodeId),
      );
      const nodeType =
        sourceNode && typeof sourceNode.type === "string"
          ? sourceNode.type
          : null;
      const sourceMask = getPortTypeMask({
        nodeType,
        handleType: "source",
        handleId: params.handleId ?? null,
      });
      setConnectionHighlight({ sourceMask });
    },
    [connectionTooltip, nodes],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      connectionTooltip.onConnectEnd(event);
      setConnectionHighlight(null);
    },
    [connectionTooltip],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const validation = validateConnection(nodes, params);
      if (!validation.ok) {
        connectionTooltip.show(validation.message ?? "Conexión no válida.");
        return;
      }

      const typed = params as Connection & { type?: string; data?: unknown };

      const newEdge: Edge = {
        id: createNodeId(),
        source: String(typed.source),
        target: String(typed.target),
        sourceHandle: typed.sourceHandle ?? null,
        targetHandle: typed.targetHandle ?? null,
        type: typed.type,
        data: (typed.data ?? {}) as Record<string, unknown>,
      };

      setEdges((edgesSnapshot) => [...edgesSnapshot, newEdge]);
      try {
        playClick();
      } catch {
        // ignore
      }
    },
    [connectionTooltip, nodes, setEdges],
  );

  return {
    connectionTooltip,
    connectionHighlight,
    onConnectStart,
    onConnectEnd,
    onConnect,
  };
}
