import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { LogicRectNodeShell } from "@/components/nodes/logic/logic-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type NotNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const NotNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "NOT",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as NotNodeData;

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
        nodeType="not"
        icon={<span className="text-xl font-medium leading-none">¬</span>}
        label={label}
        subtitle={config.subtitle}
        variant="singleInSingleOut"
        runtimeError={runtimeError}
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

NotNode.displayName = "NotNode";
