import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { LogicRectNodeShell } from "@/components/nodes/logic/logic-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type OrNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const OrNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "OR",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as OrNodeData;

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
      <LogicRectNodeShell
        nodeType="or"
        icon={<span className="text-xl font-medium leading-none">∨</span>}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

OrNode.displayName = "OrNode";
