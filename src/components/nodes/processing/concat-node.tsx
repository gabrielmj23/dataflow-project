import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Link2 } from "lucide-react";

import { TextRectNodeShell } from "@/components/nodes/text/text-rect-node-shell";
import type { TextRectNodeShellProps } from "@/components/nodes/text/text-rect-node-shell";

export type ConcatNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const ConcatNode = memo(({ data }: NodeProps) => {
  const { label = "Concatenar", runtimeError } = (data ?? {}) as ConcatNodeData;

  const shellProps: TextRectNodeShellProps = {
    nodeType: "concat",
    icon: <Link2 className="h-5 w-5" />,
    label,
    runtimeError,
    inputCount: 2,
  };

  return <TextRectNodeShell {...shellProps} />;
});

ConcatNode.displayName = "ConcatNode";
