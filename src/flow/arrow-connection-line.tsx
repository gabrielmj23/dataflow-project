import type { CSSProperties } from "react";

import { getBezierPath, type ConnectionLineComponentProps } from "@xyflow/react";

const MARKER_ID = "rf-connection-arrow";

export function ArrowConnectionLine(props: ConnectionLineComponentProps) {
  const {
    fromX,
    fromY,
    fromPosition,
    toX,
    toY,
    toPosition,
    connectionLineStyle,
  } = props;

  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  const defaultStroke =
    "var(--xy-connectionline-stroke, var(--xy-connectionline-stroke-default))";
  const strokeColor =
    typeof connectionLineStyle?.stroke === "string"
      ? connectionLineStyle.stroke
      : defaultStroke;

  const defaultStrokeWidth =
    "var(--xy-connectionline-stroke-width, var(--xy-connectionline-stroke-width-default))";
  const strokeWidth =
    typeof connectionLineStyle?.strokeWidth === "number" ||
    typeof connectionLineStyle?.strokeWidth === "string"
      ? connectionLineStyle.strokeWidth
      : defaultStrokeWidth;

  const pathStyle: CSSProperties = {
    ...connectionLineStyle,
    strokeDasharray: "none",
    strokeDashoffset: 0,
  };

  return (
    <g style={{ color: strokeColor }}>
      <defs>
        <marker
          id={MARKER_ID}
          className="react-flow__arrowhead"
          markerWidth={14}
          markerHeight={14}
          viewBox="-10 -10 20 20"
          refX="0"
          refY="0"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <polyline
            className="arrowclosed"
            points="-5,-4 0,0 -5,4 -5,-4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              stroke: strokeColor,
              fill: strokeColor,
              strokeWidth,
            }}
          />
        </marker>
      </defs>

      <path
        d={path}
        className="react-flow__connection-path"
        style={pathStyle}
        markerEnd={`url(#${MARKER_ID})`}
      />
    </g>
  );
}
