import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Replace } from "lucide-react";

import { TextRectNodeShell } from "@/components/nodes/text/text-rect-node-shell";
import type { TextRectNodeShellProps } from "@/components/nodes/text/text-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ReplaceTextNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ReplaceTextNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Reemplazar",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ReplaceTextNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Reemplazar",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const shellProps: TextRectNodeShellProps = {
    nodeType: "replaceText",
    icon: <Replace className="h-5 w-5" />,
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

ReplaceTextNode.displayName = "ReplaceTextNode";
