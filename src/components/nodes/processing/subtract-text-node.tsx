import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Eraser } from "lucide-react";

import { TextRectNodeShell } from "@/components/nodes/text/text-rect-node-shell";
import type { TextRectNodeShellProps } from "@/components/nodes/text/text-rect-node-shell";

export type SubtractTextNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const SubtractTextNode = memo(({ data }: NodeProps) => {
  const { label = "Sustraer", runtimeError } =
    (data ?? {}) as SubtractTextNodeData;

  const shellProps: TextRectNodeShellProps = {
    nodeType: "subtractText",
    icon: <Eraser className="h-5 w-5" />,
    label,
    runtimeError,
    inputCount: 2,
  };

  return <TextRectNodeShell {...shellProps} />;
});

SubtractTextNode.displayName = "SubtractTextNode";
