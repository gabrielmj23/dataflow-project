import { memo } from "react";
import { UnfoldVertical } from "lucide-react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type UnzipNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const UnzipNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Unzip",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as UnzipNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar ejecucion",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  return (
    <>
      <IterationRectNodeShell
        nodeType="unzip"
        icon={<UnfoldVertical className="h-5 w-5" />}
        label={label}
        subtitle={config.subtitle}
        variant="singleInDoubleOut"
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

UnzipNode.displayName = "UnzipNode";
