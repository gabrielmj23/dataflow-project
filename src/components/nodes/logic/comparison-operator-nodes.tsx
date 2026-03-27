import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";
import { LogicRectNodeShell } from "@/components/nodes/logic/logic-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

type FixedComparisonNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

function createFixedComparisonNode(config: {
  nodeType: string;
  label: string;
  icon: string;
  displayName: string;
}) {
  const FixedComparisonNode = memo(({ id, data }: NodeProps) => {
    const {
      label = config.label,
      runtimeError,
      executionTarget,
      transport,
      controllerId,
      controllerName,
    } = (data ?? {}) as FixedComparisonNodeData;

    const executionConfig = useMicrobitExecutionConfig({
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
          nodeType={config.nodeType}
          icon={<span className="text-2xl font-bold">{config.icon}</span>}
          label={label}
          subtitle={executionConfig.subtitle}
          runtimeError={runtimeError}
          onConnectClick={executionConfig.onConfigClick}
        />
        {executionConfig.dialog}
      </>
    );
  });

  FixedComparisonNode.displayName = config.displayName;
  return FixedComparisonNode;
}

export const ComparisonEqualNode = createFixedComparisonNode({
  nodeType: NODE_TYPES.COMPARISON_EQUAL_NODE,
  label: "Igual",
  icon: "=",
  displayName: "ComparisonEqualNode",
});

export const ComparisonNotEqualNode = createFixedComparisonNode({
  nodeType: NODE_TYPES.COMPARISON_NOT_EQUAL_NODE,
  label: "Distinto",
  icon: "≠",
  displayName: "ComparisonNotEqualNode",
});

export const ComparisonLessNode = createFixedComparisonNode({
  nodeType: NODE_TYPES.COMPARISON_LESS_NODE,
  label: "Menor",
  icon: "<",
  displayName: "ComparisonLessNode",
});

export const ComparisonLessOrEqualNode = createFixedComparisonNode({
  nodeType: NODE_TYPES.COMPARISON_LESS_OR_EQUAL_NODE,
  label: "Menor o igual",
  icon: "≤",
  displayName: "ComparisonLessOrEqualNode",
});

export const ComparisonGreaterNode = createFixedComparisonNode({
  nodeType: NODE_TYPES.COMPARISON_GREATER_NODE,
  label: "Mayor",
  icon: ">",
  displayName: "ComparisonGreaterNode",
});

export const ComparisonGreaterOrEqualNode = createFixedComparisonNode({
  nodeType: NODE_TYPES.COMPARISON_GREATER_OR_EQUAL_NODE,
  label: "Mayor o igual",
  icon: "≥",
  displayName: "ComparisonGreaterOrEqualNode",
});
