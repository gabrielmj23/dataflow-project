import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Link2 } from "lucide-react";

import { TextRectNodeShell } from "@/components/nodes/text/text-rect-node-shell";
import type { TextRectNodeShellProps } from "@/components/nodes/text/text-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ConcatNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ConcatNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Concatenar",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ConcatNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Concatenar",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const shellProps: TextRectNodeShellProps = {
    nodeType: "concat",
    icon: <Link2 className="h-5 w-5" />,
    label,
    subtitle: config.subtitle,
    runtimeError,
    inputCount: 2,
    onConnectClick: config.onConfigClick,
  };

  return (
    <>
      <TextRectNodeShell {...shellProps} />
      {config.dialog}
    </>
  );
});

ConcatNode.displayName = "ConcatNode";
