export type EdgeFeedbackMode = "transient" | "persistent";

let currentMode: EdgeFeedbackMode = "transient";
const listeners = new Set<(mode: EdgeFeedbackMode) => void>();

export function setEdgeFeedbackMode(mode: EdgeFeedbackMode) {
  if (mode === currentMode) return;
  currentMode = mode;
  listeners.forEach((fn) => fn(mode));
}

export function getEdgeFeedbackMode(): EdgeFeedbackMode {
  return currentMode;
}

export function subscribeEdgeFeedbackMode(
  listener: (mode: EdgeFeedbackMode) => void,
): () => void {
  listeners.add(listener);
  listener(currentMode);
  return () => listeners.delete(listener);
}
