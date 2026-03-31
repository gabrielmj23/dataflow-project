import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Ampersand } from "lucide-react";

import { LogicRectNodeShell } from "@/components/nodes/logic/logic-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type AndNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const AndNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "AND",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as AndNodeData;

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
        nodeType="and"
        icon={<Ampersand className="h-7 w-7" />}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

AndNode.displayName = "AndNode";
