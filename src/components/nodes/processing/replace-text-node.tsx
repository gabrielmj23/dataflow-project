import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Replace } from "lucide-react";

import { TextRectNodeShell } from "@/components/nodes/text/text-rect-node-shell";
import type { TextRectNodeShellProps } from "@/components/nodes/text/text-rect-node-shell";

export type ReplaceTextNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const ReplaceTextNode = memo(({ data }: NodeProps) => {
  const { label = "Reemplazar", runtimeError } =
    (data ?? {}) as ReplaceTextNodeData;

  const shellProps: TextRectNodeShellProps = {
    nodeType: "replaceText",
    icon: <Replace className="h-5 w-5" />,
    label,
    runtimeError,
    inputCount: 3,
  };

  return <TextRectNodeShell {...shellProps} />;
});

ReplaceTextNode.displayName = "ReplaceTextNode";
