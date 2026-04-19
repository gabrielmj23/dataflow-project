import type { Edge, Node } from "@xyflow/react";

import {
  DataflowEngine,
  type EngineLogLevel,
  type EngineNodeStatus,
  type EngineObserver,
} from "@/engine/engine";
import { deserializeProgramToEngineStores } from "@/engine/deserialize-program";
import type { DataToken } from "@/engine/program-elements";
import { serializeProgram } from "@/flow/serialization";

export type HeadlessLog = {
  level: EngineLogLevel;
  nodeId?: string;
  message: string;
  data?: unknown;
};

export type HeadlessNodeExecution = {
  nodeId: string;
  operation?: string;
  inputs: unknown[];
  result: unknown;
};

export type HeadlessNodeStatus = {
  nodeId: string;
  status: EngineNodeStatus;
  error?: unknown;
};

export type HeadlessEdgeValue = {
  edgeId: string;
  value: unknown;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  runtimeDepth?: number;
};

export async function runFlowHeadless(params: {
  nodes: Node[];
  edges: Edge[];
  maxSteps?: number;
}): Promise<{
  outputs: DataToken<unknown>[];
  logs: HeadlessLog[];
  nodeExecutions: HeadlessNodeExecution[];
  nodeStatuses: HeadlessNodeStatus[];
  edgeValues: HeadlessEdgeValue[];
}> {
  const logs: HeadlessLog[] = [];
  const nodeExecutions: HeadlessNodeExecution[] = [];
  const nodeStatuses: HeadlessNodeStatus[] = [];
  const edgeValues: HeadlessEdgeValue[] = [];

  const serialized = serializeProgram(
    {
      nodes: params.nodes,
      edges: params.edges,
    },
    false,
  );

  const stores = deserializeProgramToEngineStores(serialized);
  const engine = new DataflowEngine({ stepDelayMs: 0 });

  const observer: EngineObserver = {
    onLog: (event) => {
      logs.push(event);
    },
    onNodeExecution: (event) => {
      nodeExecutions.push(event);
    },
    onNodeStatus: (event) => {
      nodeStatuses.push(event);
    },
    onEdgeValue: (event) => {
      edgeValues.push(event);
    },
  };

  engine.setObserver(observer);
  engine.loadProgram({
    nodes: stores.nodeStore.getNodes(),
    arcs: stores.arcStore.getArcs(),
  });

  const outputs = await engine.run({
    initialTokens: [],
    maxSteps: params.maxSteps ?? 1000,
  });

  return {
    outputs,
    logs,
    nodeExecutions,
    nodeStatuses,
    edgeValues,
  };
}
