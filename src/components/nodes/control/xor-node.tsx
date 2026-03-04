import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type XorNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const XorNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "XOR",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as XorNodeData;

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
      <ControlRectNodeShell
        nodeType="xor"
        icon={<span className="text-xl font-medium leading-none">⊕</span>}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

XorNode.displayName = "XorNode";
