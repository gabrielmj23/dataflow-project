import type { Edge, Node } from "@xyflow/react";

import type { EngineObserver } from "../engine";
import type { NodeDefinition } from "../program-elements";
import type {
  RemoteExecutor,
  SubflowRuntimeContext,
  SubflowTemplateResolver,
} from "../deserialize/shared-types";

export type NodeCompilerContext = {
  writeSinkInputCountByNodeId?: Map<string, number>;
  timerHasIncomingByNodeId?: Map<string, boolean>;
  sequenceIncomingByNodeId?: Map<
    string,
    { start: boolean; end: boolean; step: boolean }
  >;
  pulseSequenceIncomingByNodeId?: Map<
    string,
    { start: boolean; end: boolean; step: boolean }
  >;
  selectorIncomingByNodeId?: Map<string, Set<string>>;
  conditionalIncomingByNodeId?: Map<string, Set<string>>;
  scatterOutputCountByNodeId?: Map<string, number>;
  gatherInputCountByNodeId?: Map<string, number>;
  gatherIncomingByNodeId?: Map<string, Set<string>>;

  onLog?: EngineObserver["onLog"];
  onPrompt?: EngineObserver["onPrompt"];
  signal?: AbortSignal;
  remoteExecutor?: RemoteExecutor;

  subflowRuntimeContext?: SubflowRuntimeContext;
  resolveSubflowTemplate?: SubflowTemplateResolver;

  helpers: {
    compileSingleInputGraph: (params: {
      graphNodes: Node[];
      graphEdges: Edge[];
      inputNodeId: string;
      inputPortId?: string;
      maxSteps?: number;
      onLog?: EngineObserver["onLog"];
      onPrompt?: EngineObserver["onPrompt"];
      signal?: AbortSignal;
    }) => (value: unknown) => Promise<unknown>;

    computeSubflowExecutionPlan: (params: {
      subflowNodes: Node[];
      subflowEdges: Edge[];
      inCount?: number;
      outCount?: number;
      onLog?: EngineObserver["onLog"];
      onPrompt?: EngineObserver["onPrompt"];
      signal?: AbortSignal;
      remoteExecutor?: RemoteExecutor;
      runtimeCtx?: SubflowRuntimeContext;
    }) => {
      engineNodes: unknown[];
      engineArcs: unknown[];
      selectedInputs: Array<{ nodeId: string; portId: string }>;
      outputSources: Array<{ nodeId: string; portId: string }>;
      hasAnyOutput: boolean;
    };

    compileSubflowNodeDefinition: (params: {
      subflowNodes: Node[];
      subflowEdges: Edge[];
      inCount?: number;
      outCount?: number;
      onLog?: EngineObserver["onLog"];
      onPrompt?: EngineObserver["onPrompt"];
      signal?: AbortSignal;
      remoteExecutor?: RemoteExecutor;
      runtimeCtx?: SubflowRuntimeContext;
    }) => NodeDefinition;
  };
};

export type NodeCompiler = (
  flowNode: Node,
  ctx: NodeCompilerContext,
) => NodeDefinition | null;
