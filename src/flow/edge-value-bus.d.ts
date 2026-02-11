declare module "@/flow/edge-value-bus" {
  export type EdgeValueSnapshot = {
    kind: "value";
    edgeId: string;
    value: unknown;
    timestamp: number;
    sourceNodeId?: string;
    targetNodeId?: string;
  };

  export type EdgeValueEvent = EdgeValueSnapshot | { kind: "reset" };

  export function subscribeEdgeValues(
    listener: (event: EdgeValueEvent) => void,
  ): () => void;

  export function publishEdgeValue(event: {
    edgeId: string;
    value: unknown;
    sourceNodeId?: string;
    targetNodeId?: string;
  }): void;

  export function clearEdgeValues(): void;

  export function getEdgeLastValue(
    edgeId: string,
  ): EdgeValueSnapshot | null;
}
