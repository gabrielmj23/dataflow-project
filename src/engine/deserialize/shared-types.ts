import type { Edge, Node } from "@xyflow/react";

export type SubflowTemplateResolution = {
  id: string;
  name?: string;
  inCount: number;
  outCount: number;
  nodes: Node[];
  edges: Edge[];
};

export type SubflowTemplateResolver = (
  id: string,
) => SubflowTemplateResolution | null;

export type SubflowRuntimeContext = {
  depth: number;
  maxDepth: number;
  resolveTemplate?: SubflowTemplateResolver;
  inlineTemplates?: Map<string, SubflowTemplateResolution>;
  currentTemplateId?: string;
};

export type RemoteExecutionOp =
  | "sum"
  | "subtract"
  | "multiply"
  | "divide"
  | "mod"
  | "power"
  | "floor"
  | "ceiling"
  | "round"
  | "concat"
  | "replaceText"
  | "subtractText"
  | "sliceText"
  | "generateSequence"
  | "pulseSequence"
  | "zip"
  | "unzip"
  | "filterTruthy"
  | "mapIdentity"
  | "reduceSum"
  | "count"
  | "listFirst"
  | "listLast"
  | "listAtPosition"
  | "listRemoveFirst"
  | "listPrepend"
  | "listAppend"
  | "listIsEmpty"
  | "scatter"
  | "gather"
  | "sortListAsc"
  | "sortListDesc"
  | "subflow";

export type RemoteSubflowPayload = {
  nodes: Node[];
  edges: Edge[];
  selectedInputs: Array<{ nodeId: string; portId: string }>;
  outputSources: Array<{ nodeId: string; portId: string }>;
  hasAnyOutput: boolean;
};

export type RemoteExecutionRequest = {
  nodeId: string;
  controllerId: string;
  op: RemoteExecutionOp;
  args: unknown[];
  subflow?: RemoteSubflowPayload;
};

export type RemoteExecutor = (req: RemoteExecutionRequest) => Promise<unknown>;
