import { MarkerType, type DefaultEdgeOptions } from "@xyflow/react";

// Single source of truth for edge visuals across all editors/canvases.
export const EDGE_STROKE_WIDTH = 2.4;
export const EDGE_MARKER_SIZE = 10;

export const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: EDGE_MARKER_SIZE,
    height: EDGE_MARKER_SIZE,
  },
  style: {
    strokeWidth: EDGE_STROKE_WIDTH,
  },
};
