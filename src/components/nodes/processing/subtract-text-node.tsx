import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Eraser } from "lucide-react";

import { TextRectNodeShell } from "@/components/nodes/text/text-rect-node-shell";
import type { TextRectNodeShellProps } from "@/components/nodes/text/text-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type SubtractTextNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const SubtractTextNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Eliminar",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as SubtractTextNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Eliminar",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const shellProps: TextRectNodeShellProps = {
    nodeType: "subtractText",
    icon: <Eraser className="h-5 w-5" />,
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

SubtractTextNode.displayName = "SubtractTextNode";
