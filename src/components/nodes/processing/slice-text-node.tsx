import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Scissors } from "lucide-react";

import { TextRectNodeShell } from "@/components/nodes/text/text-rect-node-shell";
import type { TextRectNodeShellProps } from "@/components/nodes/text/text-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type SliceTextNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const SliceTextNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Recortar",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as SliceTextNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Recortar",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const shellProps: TextRectNodeShellProps = {
    nodeType: "sliceText",
    icon: <Scissors className="h-5 w-5" />,
    label,
    subtitle: config.subtitle,
    runtimeError,
    inputCount: 3,
    onConnectClick: config.onConfigClick,
  };

  return (
    <>
      <TextRectNodeShell {...shellProps} />
      {config.dialog}
    </>
  );
});

SliceTextNode.displayName = "SliceTextNode";
