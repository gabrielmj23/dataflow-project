import { memo, type ReactNode } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ProcessingExecutionNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export type ProcessingExecutionNodeProps = NodeProps & {
  nodeType: string;
  icon: ReactNode;
  defaultLabel: string;
  configTitle: string;
};

export const ProcessingExecutionNode = memo(
  ({
    id,
    data,
    nodeType,
    icon,
    defaultLabel,
    configTitle,
  }: ProcessingExecutionNodeProps) => {
    const {
      label = defaultLabel,
      runtimeError,
      executionTarget,
      transport,
      controllerId,
      controllerName,
    } = (data ?? {}) as ProcessingExecutionNodeData;

    const config = useMicrobitExecutionConfig({
      nodeId: id,
      title: configTitle,
      executionTarget,
      transport,
      controllerId,
      controllerName,
    });

    return (
      <>
        <ProcessingRectNodeShell
          nodeType={nodeType}
          icon={icon}
          label={label}
          subtitle={config.subtitle}
          runtimeError={runtimeError}
          onConfigClick={config.onConfigClick}
        />
        {config.dialog}
      </>
    );
  },
);

ProcessingExecutionNode.displayName = "ProcessingExecutionNode";
