import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Scissors } from "lucide-react";

import { TextRectNodeShell } from "@/components/nodes/text/text-rect-node-shell";
import type { TextRectNodeShellProps } from "@/components/nodes/text/text-rect-node-shell";

export type SliceTextNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const SliceTextNode = memo(({ data }: NodeProps) => {
  const { label = "Recortar", runtimeError } = (data ?? {}) as SliceTextNodeData;

  const shellProps: TextRectNodeShellProps = {
    nodeType: "sliceText",
    icon: <Scissors className="h-5 w-5" />,
    label,
    runtimeError,
    inputCount: 3,
  };

  return <TextRectNodeShell {...shellProps} />;
});

SliceTextNode.displayName = "SliceTextNode";
