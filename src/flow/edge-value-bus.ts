export type EdgeValueSnapshot = {
  kind: "value";
  edgeId: string;
  value: unknown;
  timestamp: number;
  sourceNodeId?: string;
  targetNodeId?: string;
  runtimeDepth?: number;
};

export type EdgeValueEvent = EdgeValueSnapshot | { kind: "reset" };

type Listener = (event: EdgeValueEvent) => void;

const listeners = new Set<Listener>();
const lastValueByEdge = new Map<string, EdgeValueSnapshot>();
const firstValueByEdge = new Map<string, EdgeValueSnapshot>();

function emit(event: EdgeValueEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      // Swallow listener errors so one bad subscriber does not break others.
      console.error("edge-value-bus listener error", err);
    }
  }
}

export function subscribeEdgeValues(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishEdgeValue(event: {
  edgeId: string;
  value: unknown;
  sourceNodeId?: string;
  targetNodeId?: string;
  runtimeDepth?: number;
}): void {
  const snapshot: EdgeValueSnapshot = {
    kind: "value",
    edgeId: event.edgeId,
    value: event.value,
    timestamp: Date.now(),
    sourceNodeId: event.sourceNodeId,
    targetNodeId: event.targetNodeId,
    runtimeDepth: event.runtimeDepth,
  };
  const prevFirst = firstValueByEdge.get(event.edgeId);
  const prevDepth = prevFirst?.runtimeDepth ?? Number.POSITIVE_INFINITY;
  const nextDepth = snapshot.runtimeDepth ?? Number.POSITIVE_INFINITY;
  if (!prevFirst || nextDepth < prevDepth) {
    firstValueByEdge.set(event.edgeId, snapshot);
  }
  lastValueByEdge.set(event.edgeId, snapshot);
  if (import.meta.env.DEV) {
    // Debug aid: surface values in dev console to verify emission.
    console.debug("edge-value", snapshot);
  }
  emit(snapshot);
}

export function clearEdgeValues(): void {
  if (lastValueByEdge.size === 0 && firstValueByEdge.size === 0) return;
  firstValueByEdge.clear();
  lastValueByEdge.clear();
  emit({ kind: "reset" });
}

export function getEdgeLastValue(edgeId: string): EdgeValueSnapshot | null {
  return lastValueByEdge.get(edgeId) ?? null;
}

export function getEdgeFirstValue(edgeId: string): EdgeValueSnapshot | null {
  return firstValueByEdge.get(edgeId) ?? null;
}
