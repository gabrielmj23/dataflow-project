import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ZipNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ZipNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Zip",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ZipNodeData;

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
        nodeType="zip"
        icon={
          <img src="/zipper.png" className="h-11 -mb-2.25 -mt-2.5 -rotate-90" />
        }
        label={label}
        subtitle={config.subtitle}
        variant="doubleInSingleOut"
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

ZipNode.displayName = "ZipNode";
