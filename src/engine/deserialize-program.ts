import type { Edge, Node } from "@xyflow/react";

import type { SerializedProgramV1 } from "@/flow/serialization";
import { deserializeProgram } from "@/flow/serialization";
import { NODE_TYPES } from "@/common/constants";

import {
  Arc,
  Node as EngineNode,
  DataToken,
  PortAddress,
  FirePatterns,
  NodeDefinition,
} from "./program-elements";
import { ArcStore, NodeStore } from "./stores";
import { DataflowEngine, type EngineObserver } from "./engine";

import { mapHandleToPortId, parseIndexHandle } from "./handle-mapping";

import { asRecord } from "./deserialize/utils";
import { compileNodeDefinition } from "./node-compilers";

type SubflowTemplateResolution = {
  id: string;
  name?: string;
  inCount: number;
  outCount: number;
  nodes: Node[];
  edges: Edge[];
};

type SubflowTemplateResolver = (id: string) => SubflowTemplateResolution | null;

type SubflowRuntimeContext = {
  depth: number;
  maxDepth: number;
  resolveTemplate?: SubflowTemplateResolver;
  inlineTemplates?: Map<string, SubflowTemplateResolution>;
  currentTemplateId?: string;
};

export type EngineProgramStores = {
  nodeStore: NodeStore;
  arcStore: ArcStore;
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
  | "listFindElement"
  | "listRemoveFirst"
  | "listRemoveLast"
  | "listPrepend"
  | "listAppend"
  | "listIsEmpty"
  | "listReverse"
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

/**
 * Infers the number of *input* ports for a given node definition.
 *
 * The engine encodes inputs as the first `firePatterns.length` port IDs in
 * `def.ports`. However, some source nodes (Constante/Random/Timer/Sequence)
 * are modeled as `FirePatterns.ALWAYS` with a single port named `output`.
 * At runtime, these nodes consume zero tokens and only produce an output.
 *
 * For graph analysis (e.g., discovering open ports inside subflows), treat
 * those nodes as having 0 inputs.
 */
function inferredInputPortCount(def: NodeDefinition): number {
  // In this engine, "source" nodes (Constante, Random, Timer, Sequence) are
  // modeled as FirePatterns.ALWAYS with a single port named "output".
  // At runtime they consume zero tokens and produce one output token.
  // For graph analysis (open ports), treat them as having 0 inputs.
  if (
    def.firePatterns.length === 1 &&
    def.firePatterns[0] === FirePatterns.ALWAYS &&
    def.ports.length === 1
  ) {
    return 0;
  }

  return def.firePatterns.length;
}

/**
 * Returns the input port IDs for a node definition.
 *
 * Inputs are inferred from the node definition's fire patterns.
 */
function inputPortIds(def: NodeDefinition): string[] {
  const inputCount = inferredInputPortCount(def);
  return def.ports.slice(0, inputCount);
}

/**
 * Returns the output port IDs for a node definition.
 *
 * Outputs are the remaining ports after the inferred inputs.
 */
function outputPortIds(def: NodeDefinition): string[] {
  const inputCount = inferredInputPortCount(def);
  return def.ports.slice(inputCount);
}

/**
 * Builds engine stores from a UI graph (XYFlow nodes and edges).
 *
 * Responsibilities:
 * - Converts each UI node into an engine `NodeDefinition`.
 * - Converts each UI edge into an engine `Arc`, mapping UI handles to
 *   engine port IDs.
 */
export function buildEngineStoresFromFlowGraph(params: {
  nodes: Node[];
  edges: Edge[];
  onLog?: EngineObserver["onLog"];
  onPrompt?: EngineObserver["onPrompt"];
  signal?: AbortSignal;
  remoteExecutor?: RemoteExecutor;
  resolveSubflowTemplate?: SubflowTemplateResolver;
  maxSubflowDepth?: number;
  subflowRuntimeContext?: SubflowRuntimeContext;
}): EngineProgramStores {
  // Exclude UI-only nodes (e.g., comments) from engine stores.
  const uiNodes = params.nodes.filter(
    (n) => String(n.type) !== NODE_TYPES.COMMENT_NODE,
  );
  const nodeById = new Map<string, Node>();
  for (const node of uiNodes) {
    nodeById.set(String(node.id), node);
  }

  // For nodes with dynamic port counts (e.g., Write sink), infer the required
  // input count from the incoming edges.
  const writeSinkInputCountByNodeId = new Map<string, number>();
  const timerHasIncomingByNodeId = new Map<string, boolean>();
  const sequenceIncomingByNodeId = new Map<
    string,
    { start: boolean; end: boolean; step: boolean }
  >();
  const pulseSequenceIncomingByNodeId = new Map<
    string,
    { start: boolean; end: boolean; step: boolean }
  >();
  const selectorIncomingByNodeId = new Map<string, Set<string>>();
  const conditionalIncomingByNodeId = new Map<string, Set<string>>();
  const scatterOutputCountByNodeId = new Map<string, number>();
  const gatherInputCountByNodeId = new Map<string, number>();
  const gatherIncomingByNodeId = new Map<string, Set<string>>();
  for (const edge of params.edges) {
    const sourceId = String(edge.source);
    const sourceNode = nodeById.get(sourceId);
    if (sourceNode?.type === NODE_TYPES.SCATTER_NODE) {
      const handleId = edge.sourceHandle ?? null;
      const idx = parseIndexHandle(handleId) ?? (handleId == null ? 1 : null);
      if (idx) {
        const current = scatterOutputCountByNodeId.get(sourceId) ?? 0;
        scatterOutputCountByNodeId.set(sourceId, Math.max(current, idx));
      }
    }

    const targetId = String(edge.target);
    const targetNode = nodeById.get(targetId);
    if (!targetNode) continue;

    if (targetNode.type === NODE_TYPES.GATHER_NODE) {
      const handleId = edge.targetHandle ?? null;
      const idx = parseIndexHandle(handleId) ?? (handleId == null ? 1 : null);
      if (idx) {
        const current = gatherInputCountByNodeId.get(targetId) ?? 0;
        gatherInputCountByNodeId.set(targetId, Math.max(current, idx));
        const set = gatherIncomingByNodeId.get(targetId) ?? new Set<string>();
        set.add(`input${idx}`);
        gatherIncomingByNodeId.set(targetId, set);
      }
    }

    if (targetNode.type === NODE_TYPES.TIMER_INPUT) {
      timerHasIncomingByNodeId.set(targetId, true);
    }

    if (targetNode.type === NODE_TYPES.GENERATE_SEQUENCE_NODE) {
      const handle = edge.targetHandle ?? "in-1";
      const entry =
        sequenceIncomingByNodeId.get(targetId) ??
        ({ start: false, end: false, step: false } as const);
      const next = { ...entry };
      if (handle === "in-1" || handle == null) next.start = true;
      if (handle === "in-2") next.end = true;
      if (handle === "in-3") next.step = true;
      sequenceIncomingByNodeId.set(targetId, next);
    }

    if (targetNode.type === NODE_TYPES.PULSE_SEQUENCE_NODE) {
      const handle = edge.targetHandle ?? "in-1";
      const entry =
        pulseSequenceIncomingByNodeId.get(targetId) ??
        ({ start: false, end: false, step: false } as const);
      const next = { ...entry };
      if (handle === "in-1" || handle == null) next.start = true;
      if (handle === "in-2") next.end = true;
      if (handle === "in-3") next.step = true;
      pulseSequenceIncomingByNodeId.set(targetId, next);
    }

    if (targetNode.type === NODE_TYPES.SELECTOR_NODE) {
      const portId = mapHandleToPortId({
        nodeId: targetId,
        nodeType: targetNode.type,
        handleId: edge.targetHandle ?? null,
        direction: "target",
      });
      if (portId) {
        const set = selectorIncomingByNodeId.get(targetId) ?? new Set<string>();
        set.add(portId);
        selectorIncomingByNodeId.set(targetId, set);
      }
    }

    if (targetNode.type === NODE_TYPES.CONDITIONAL_NODE) {
      const portId = mapHandleToPortId({
        nodeId: targetId,
        nodeType: targetNode.type,
        handleId: edge.targetHandle ?? null,
        direction: "target",
      });
      if (portId) {
        const set =
          conditionalIncomingByNodeId.get(targetId) ?? new Set<string>();
        set.add(portId);
        conditionalIncomingByNodeId.set(targetId, set);
      }
    }

    if (targetNode.type !== NODE_TYPES.WRITE_SINK) continue;

    const handleId = edge.targetHandle ?? null;
    const idx = handleId == null ? 1 : (parseIndexHandle(handleId) ?? 1);
    const current = writeSinkInputCountByNodeId.get(targetId) ?? 1;
    writeSinkInputCountByNodeId.set(targetId, Math.max(current, idx));
  }

  const runtimeCtx: SubflowRuntimeContext = params.subflowRuntimeContext ?? {
    depth: 0,
    maxDepth: params.maxSubflowDepth ?? 1000,
    resolveTemplate: params.resolveSubflowTemplate,
    inlineTemplates: new Map<string, SubflowTemplateResolution>(),
  };

  // Ensure helpers exist even when a runtime context was provided upstream.
  if (!runtimeCtx.inlineTemplates) {
    runtimeCtx.inlineTemplates = new Map<string, SubflowTemplateResolution>();
  }
  if (!runtimeCtx.resolveTemplate && params.resolveSubflowTemplate) {
    runtimeCtx.resolveTemplate = params.resolveSubflowTemplate;
  }

  // Pre-register any subflow definitions that are embedded directly on UI
  // nodes into `inlineTemplates`. Doing this before compiling node
  // definitions ensures self-references (nodes that call the same template
  // id) can be resolved regardless of the order in which `flowNodeToEngineDefinition`
  // is invoked for the UI nodes.
  for (const n of uiNodes) {
    try {
      const dt = asRecord(n.data);
      if (
        (n.type === NODE_TYPES.SUBFLOW ||
          n.type === NODE_TYPES.REPLICATE_FLOW) &&
        Array.isArray(dt.subflowNodes) &&
        Array.isArray(dt.subflowEdges)
      ) {
        const templateIdRaw = dt.templateId;
        const templateId =
          typeof templateIdRaw === "string" && templateIdRaw.trim().length > 0
            ? templateIdRaw.trim()
            : String(n.id);

        const inCount = typeof dt.inCount === "number" ? dt.inCount : 0;
        const outCount = typeof dt.outCount === "number" ? dt.outCount : 0;

        runtimeCtx.inlineTemplates.set(templateId, {
          id: templateId,
          name: typeof dt.label === "string" ? dt.label : undefined,
          inCount,
          outCount,
          nodes: dt.subflowNodes as Node[],
          edges: dt.subflowEdges as Edge[],
        });
      }
    } catch {
      // ignore malformed node.data
    }
  }

  const nodeStore = new NodeStore();
  const arcStore = new ArcStore();

  for (const flowNode of uiNodes) {
    const engineDef = flowNodeToEngineDefinition(flowNode, {
      writeSinkInputCountByNodeId,
      timerHasIncomingByNodeId,
      sequenceIncomingByNodeId,
      pulseSequenceIncomingByNodeId,
      selectorIncomingByNodeId,
      conditionalIncomingByNodeId,
      scatterOutputCountByNodeId,
      gatherInputCountByNodeId,
      gatherIncomingByNodeId,
      onLog: params.onLog,
      onPrompt: params.onPrompt,
      signal: params.signal,
      remoteExecutor: params.remoteExecutor,
      subflowRuntimeContext: runtimeCtx,
      resolveSubflowTemplate: params.resolveSubflowTemplate,
    });
    nodeStore.addNode(new EngineNode(String(flowNode.id), engineDef.clone()));
  }

  for (const edge of params.edges) {
    const sourceId = String(edge.source);
    const targetId = String(edge.target);

    const sourceNode = nodeById.get(sourceId);
    const targetNode = nodeById.get(targetId);

    if (!sourceNode) {
      throw new Error(
        `Edge ${edge.id} references missing source node '${sourceId}'.`,
      );
    }
    if (!targetNode) {
      throw new Error(
        `Edge ${edge.id} references missing target node '${targetId}'.`,
      );
    }

    const sourcePortId = mapHandleToPortId({
      nodeId: sourceId,
      nodeType: sourceNode.type,
      handleId: edge.sourceHandle ?? null,
      direction: "source",
    });

    const targetPortId = mapHandleToPortId({
      nodeId: targetId,
      nodeType: targetNode.type,
      handleId: edge.targetHandle ?? null,
      direction: "target",
    });

    arcStore.addArc(
      new Arc(
        new PortAddress(sourceId, sourcePortId),
        new PortAddress(targetId, targetPortId),
        String(edge.id),
      ),
    );
  }

  return { nodeStore, arcStore };
}

/**
 * Computes the set of node IDs reachable from a starting node, following arcs
 * in the forward direction.
 */
function findReachableNodeIds(params: {
  startNodeId: string;
  arcs: Arc[];
}): Set<string> {
  const adjacency = new Map<string, Set<string>>();
  for (const arc of params.arcs) {
    const from = arc.source.nodeId;
    const to = arc.target.nodeId;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from)?.add(to);
  }

  const visited = new Set<string>();
  const queue: string[] = [params.startNodeId];
  visited.add(params.startNodeId);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const next = adjacency.get(current);
    if (!next) continue;
    for (const neighbor of next) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited;
}

/**
 * Picks a deterministic "single output" (a port with no outgoing arc).
 *
 * Used when compiling embedded graphs (e.g., Map/Filter) where we need one
 * return value.
 */
function chooseSingleOutputPort(params: {
  nodes: EngineNode[];
  arcs: Arc[];
  reachableNodeIds?: Set<string>;
  excludeNodeIds?: Set<string>;
}): { nodeId: string; portId: string } | null {
  const hasOutgoing = new Set<string>();
  for (const arc of params.arcs) {
    hasOutgoing.add(`${arc.source.nodeId}:${arc.source.portId}`);
  }

  const candidates: Array<{ nodeId: string; portId: string }> = [];
  for (const node of params.nodes) {
    if (params.excludeNodeIds?.has(node.id)) continue;
    if (params.reachableNodeIds && !params.reachableNodeIds.has(node.id)) {
      continue;
    }

    for (const portId of outputPortIds(node.nodeDefinition)) {
      if (!hasOutgoing.has(`${node.id}:${portId}`)) {
        candidates.push({ nodeId: node.id, portId });
      }
    }
  }

  candidates.sort((a, b) =>
    a.nodeId === b.nodeId
      ? a.portId.localeCompare(b.portId)
      : a.nodeId.localeCompare(b.nodeId),
  );

  return candidates[0] ?? null;
}

/**
 * Compiles a UI subgraph into an async function `value -> result` by running a
 * nested engine instance.
 *
 * This is used for embedded editors (Map/Filter):
 * - An explicit "input value" node provides the starting token.
 * - A single "open output" is selected as the result.
 *
 * If compilation fails, the function falls back to identity.
 */
function compileSingleInputGraph(params: {
  graphNodes: Node[];
  graphEdges: Edge[];
  inputNodeId: string;
  inputPortId?: string;
  maxSteps?: number;
  onLog?: EngineObserver["onLog"];
  onPrompt?: EngineObserver["onPrompt"];
  signal?: AbortSignal;
}): (value: unknown) => Promise<unknown> {
  const inputPortId = params.inputPortId ?? "input";

  // We compile to a nested engine execution. If compilation fails, fall back to identity.
  return async (value: unknown) => {
    try {
      if (params.signal?.aborted) {
        const err = new Error("Aborted");
        (err as { name?: string }).name = "AbortError";
        throw err;
      }

      const stores = buildEngineStoresFromFlowGraph({
        nodes: params.graphNodes,
        edges: params.graphEdges,
        onLog: params.onLog,
        onPrompt: params.onPrompt,
        signal: params.signal,
      });

      const engine = new DataflowEngine({ stepDelayMs: 0 });
      if (params.onLog || params.onPrompt) {
        engine.setObserver({
          onLog: params.onLog,
          onPrompt: params.onPrompt,
        });
      }
      const engineNodes = stores.nodeStore.getNodes();
      const engineArcs = stores.arcStore.getArcs();

      const reachable = findReachableNodeIds({
        startNodeId: params.inputNodeId,
        arcs: engineArcs,
      });

      const chosen = chooseSingleOutputPort({
        nodes: engineNodes,
        arcs: engineArcs,
        reachableNodeIds: reachable,
        excludeNodeIds: new Set([params.inputNodeId]),
      });

      // Even if the embedded graph has no open output port (e.g. it ends in a
      // Write node which is a sink), we still want to *run* it so side effects
      // (logs) are surfaced. In that case, fall back to identity.
      if (!chosen) {
        engine.loadProgram({ nodes: engineNodes, arcs: engineArcs });
        await engine.run({
          initialTokens: [
            new DataToken(
              value,
              new PortAddress(params.inputNodeId, inputPortId),
            ),
          ],
          maxSteps: params.maxSteps,
          signal: params.signal,
        });
        return value;
      }

      const OUT_PORT = "result";
      const augmentedArcs = [
        ...engineArcs,
        new Arc(
          new PortAddress(chosen.nodeId, chosen.portId),
          new PortAddress("", OUT_PORT),
          `${chosen.nodeId}:${chosen.portId}->${OUT_PORT}`,
        ),
      ];

      engine.loadProgram({ nodes: engineNodes, arcs: augmentedArcs });
      const emitted = await engine.run({
        initialTokens: [
          new DataToken(
            value,
            new PortAddress(params.inputNodeId, inputPortId),
          ),
        ],
        maxSteps: params.maxSteps,
        signal: params.signal,
      });

      const result = emitted
        .filter(
          (t) => t.location.nodeId === "" && t.location.portId === OUT_PORT,
        )
        .at(-1);

      return result?.value;
    } catch (err) {
      // Never swallow aborts; they must bubble up to stop the outer run.
      if ((err as { name?: unknown } | null)?.name === "AbortError") {
        throw err;
      }
      console.warn("Failed to compile/run inner graph:", err);
      return value;
    }
  };
}

/**
 * Computes "open" ports in a graph:
 * - open inputs: input ports with no incoming arc
 * - open outputs: output ports with no outgoing arc
 *
 * This is used to infer a subflow's exposed inputs/outputs.
 */
function computeOpenPorts(params: { nodes: EngineNode[]; arcs: Arc[] }): {
  openInputs: Array<{ nodeId: string; portId: string }>;
  openOutputs: Array<{ nodeId: string; portId: string }>;
} {
  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();

  for (const arc of params.arcs) {
    hasOutgoing.add(`${arc.source.nodeId}:${arc.source.portId}`);
    hasIncoming.add(`${arc.target.nodeId}:${arc.target.portId}`);
  }

  const openInputs: Array<{ nodeId: string; portId: string }> = [];
  const openOutputs: Array<{ nodeId: string; portId: string }> = [];

  for (const node of params.nodes) {
    for (const portId of inputPortIds(node.nodeDefinition)) {
      if (!hasIncoming.has(`${node.id}:${portId}`)) {
        openInputs.push({ nodeId: node.id, portId });
      }
    }
    for (const portId of outputPortIds(node.nodeDefinition)) {
      if (!hasOutgoing.has(`${node.id}:${portId}`)) {
        openOutputs.push({ nodeId: node.id, portId });
      }
    }
  }

  const byKey = (
    a: { nodeId: string; portId: string },
    b: { nodeId: string; portId: string },
  ) =>
    a.nodeId === b.nodeId
      ? a.portId.localeCompare(b.portId)
      : a.nodeId.localeCompare(b.nodeId);

  openInputs.sort(byKey);
  openOutputs.sort(byKey);

  return { openInputs, openOutputs };
}

type SubflowExecutionPlan = {
  engineNodes: EngineNode[];
  engineArcs: Arc[];
  selectedInputs: Array<{ nodeId: string; portId: string }>;
  outputSources: Array<{ nodeId: string; portId: string }>;
  hasAnyOutput: boolean;
};

function computeSubflowExecutionPlan(params: {
  subflowNodes: Node[];
  subflowEdges: Edge[];
  inCount?: number;
  outCount?: number;
  onLog?: EngineObserver["onLog"];
  onPrompt?: EngineObserver["onPrompt"];
  signal?: AbortSignal;
  remoteExecutor?: RemoteExecutor;
  runtimeCtx?: SubflowRuntimeContext;
}): SubflowExecutionPlan {
  const stores = buildEngineStoresFromFlowGraph({
    nodes: params.subflowNodes,
    edges: params.subflowEdges,
    onLog: params.onLog,
    onPrompt: params.onPrompt,
    signal: params.signal,
    remoteExecutor: params.remoteExecutor,
    subflowRuntimeContext: params.runtimeCtx,
    resolveSubflowTemplate: params.runtimeCtx?.resolveTemplate,
    maxSubflowDepth: params.runtimeCtx?.maxDepth,
  });

  const engineNodes = stores.nodeStore.getNodes();
  const engineArcs = stores.arcStore.getArcs();

  // Prefer explicit `subflowInput` nodes for exposed inputs. These are
  // ordered top-to-bottom (then left-to-right) to match the editor view.
  const explicitInputs = params.subflowNodes
    .filter((n) => String(n.type) === NODE_TYPES.SUBFLOW_INPUT)
    .slice()
    .sort((a, b) => {
      const ay = (a.position?.y ?? 0) as number;
      const by = (b.position?.y ?? 0) as number;
      if (ay !== by) return ay - by;
      const ax = (a.position?.x ?? 0) as number;
      const bx = (b.position?.x ?? 0) as number;
      return ax - bx;
    })
    .map((n) => ({ nodeId: String(n.id), portId: "input" }));

  // Allow explicit "return" points via `subflowOutput` nodes. These can be
  // multiple, but they all feed the same single exposed salida of the subflujo.
  const explicitOutputs = params.subflowNodes
    .filter((n) => String(n.type) === NODE_TYPES.SUBFLOW_OUTPUT)
    .slice()
    .sort((a, b) => {
      const ay = (a.position?.y ?? 0) as number;
      const by = (b.position?.y ?? 0) as number;
      if (ay !== by) return ay - by;
      const ax = (a.position?.x ?? 0) as number;
      const bx = (b.position?.x ?? 0) as number;
      return ax - bx;
    })
    .map((n) => ({ nodeId: String(n.id), portId: "output" }));

  // Compute open ports from the compiled inner graph.
  const { openInputs, openOutputs } = computeOpenPorts({
    nodes: engineNodes,
    arcs: engineArcs,
  });

  const selectedInputs =
    explicitInputs.length > 0
      ? explicitInputs
      : typeof params.inCount === "number"
        ? openInputs.slice(0, Math.max(0, params.inCount))
        : openInputs;

  // Output source nodes that feed the single exposed salida.
  const outputSources = (() => {
    if (explicitOutputs.length > 0) return explicitOutputs;
    if (typeof params.outCount === "number") {
      return openOutputs.slice(0, Math.max(0, params.outCount));
    }
    return openOutputs;
  })();

  const hasAnyOutput = outputSources.length > 0;

  return {
    engineNodes,
    engineArcs,
    selectedInputs,
    outputSources,
    hasAnyOutput,
  };
}

/**
 * Compiles a Subflow UI node into an engine `NodeDefinition`.
 *
 * The subflow definition executes an inner program in a nested engine:
 * - External inputs are injected into selected open input ports.
 * - Selected open output ports are forwarded to special external ports
 *   (nodeId "") so they can be observed.
 *
 * `inCount/outCount` control how many open ports to expose. If omitted, all
 * open ports are exposed.
 */
function compileSubflowNodeDefinition(params: {
  subflowNodes: Node[];
  subflowEdges: Edge[];
  /**
   * Number of exposed input ports for the subflow.
   *
   * If omitted, all open inputs in the inner graph are exposed.
   * (This is important for older/hand-crafted graphs where `inCount` isn't persisted.)
   */
  inCount?: number;
  /**
   * Number of exposed output ports for the subflow.
   *
   * If omitted, all open outputs in the inner graph are exposed.
   */
  outCount?: number;
  onLog?: EngineObserver["onLog"];
  onPrompt?: EngineObserver["onPrompt"];
  signal?: AbortSignal;
  remoteExecutor?: RemoteExecutor;
  runtimeCtx?: SubflowRuntimeContext;
}): NodeDefinition {
  const plan = computeSubflowExecutionPlan({
    subflowNodes: params.subflowNodes,
    subflowEdges: params.subflowEdges,
    inCount: params.inCount,
    outCount: params.outCount,
    onLog: params.onLog,
    onPrompt: params.onPrompt,
    signal: params.signal,
    remoteExecutor: params.remoteExecutor,
    runtimeCtx: params.runtimeCtx,
  });

  const engineNodes = plan.engineNodes;
  const engineArcs = plan.engineArcs;
  const selectedInputs = plan.selectedInputs;
  const outputSources = plan.outputSources;
  const hasAnyOutput = plan.hasAnyOutput;

  // Always expose at most one output port externally; multiple internal
  // `subflowOutput` nodes funnel into the same exposed salida.
  const firePatterns = selectedInputs.map(() => FirePatterns.EXISTS);
  const inputPorts = selectedInputs.map((_, idx) => `input${idx + 1}`);
  const outputPorts = hasAnyOutput ? ["output1"] : [];
  // Debug information to help trace subflow port mapping during runtime.
  try {
    console.debug(
      "compileSubflowNodeDefinition: selectedInputs",
      selectedInputs,
    );

    console.debug("compileSubflowNodeDefinition: outputSources", outputSources);
  } catch {
    /* ignore */
  }

  return new NodeDefinition(
    async (...args: unknown[]) => {
      // Log runtime invocation arguments to help diagnose missing tokens.
      try {
        console.debug(
          "subflow.run: args",
          args,
          "mappedTo",
          selectedInputs.map((s, i) => ({ argIndex: i, target: s })),
        );
      } catch {
        /* ignore */
      }
      const ctx = params.runtimeCtx;
      if (ctx) {
        if (ctx.depth >= ctx.maxDepth) {
          throw new Error(
            `Se superó la profundidad máxima de recursión (${ctx.maxDepth}).`,
          );
        }
        ctx.depth += 1;
      }

      const engine = new DataflowEngine({ stepDelayMs: 0 });
      if (params.onLog || params.onPrompt) {
        engine.setObserver({
          onLog: params.onLog,
          onPrompt: params.onPrompt,
        });
      }

      const augmentedArcs = [...engineArcs];
      if (hasAnyOutput) {
        for (const out of outputSources) {
          augmentedArcs.push(
            new Arc(
              new PortAddress(out.nodeId, out.portId),
              new PortAddress("", "out-1"),
              `${out.nodeId}:${out.portId}->out-1`,
            ),
          );
        }
      }

      engine.loadProgram({ nodes: engineNodes, arcs: augmentedArcs });

      const initialTokens = selectedInputs.map(
        (addr, idx) =>
          new DataToken(args[idx], new PortAddress(addr.nodeId, addr.portId)),
      );

      let emitted: DataToken<unknown>[] = [];
      try {
        emitted = await engine.run({
          initialTokens,
          signal: params.signal,
        });
      } finally {
        if (ctx) {
          ctx.depth -= 1;
        }
      }

      if (!hasAnyOutput) {
        return [];
      }

      // Single exposed output: pick the first token produced on out-1.
      const token = emitted.find(
        (t) => t.location.nodeId === "" && t.location.portId === "out-1",
      );
      return token?.value;
    },
    firePatterns,
    [...inputPorts, ...outputPorts],
    { skipStepDelay: true },
  );
}

/**
 * Converts a UI node into an engine `NodeDefinition`.
 *
 * The mapping is based on the node's `type` and its serialized `data`.
 */
function flowNodeToEngineDefinition(
  flowNode: Node,
  context?: {
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
  },
): NodeDefinition {
  return compileNodeDefinition(flowNode, {
    writeSinkInputCountByNodeId: context?.writeSinkInputCountByNodeId,
    timerHasIncomingByNodeId: context?.timerHasIncomingByNodeId,
    sequenceIncomingByNodeId: context?.sequenceIncomingByNodeId,
    pulseSequenceIncomingByNodeId: context?.pulseSequenceIncomingByNodeId,
    selectorIncomingByNodeId: context?.selectorIncomingByNodeId,
    conditionalIncomingByNodeId: context?.conditionalIncomingByNodeId,
    scatterOutputCountByNodeId: context?.scatterOutputCountByNodeId,
    gatherInputCountByNodeId: context?.gatherInputCountByNodeId,
    gatherIncomingByNodeId: context?.gatherIncomingByNodeId,
    onLog: context?.onLog,
    onPrompt: context?.onPrompt,
    signal: context?.signal,
    remoteExecutor: context?.remoteExecutor,
    subflowRuntimeContext: context?.subflowRuntimeContext,
    resolveSubflowTemplate: context?.resolveSubflowTemplate,
    helpers: {
      compileSingleInputGraph,
      computeSubflowExecutionPlan,
      compileSubflowNodeDefinition,
    },
  });
}

/**
 * Converts a serialized UI program into engine stores (`NodeStore` + `ArcStore`).
 *
 * This function bridges the UI graph (React Flow) with the engine model:
 * - Flow node types are mapped into engine `NodeDefinition`s.
 * - Flow edges (with UI handle IDs) are mapped into engine ports (`PortAddress`).
 *
 * Limitations:
 * - Nodes like `baseNode` and `subflow` are not supported by the engine loader.
 * - `filter`/`map` currently use placeholder functions until their internal graphs
 *   are compiled into predicates/mappers.
 */
export function deserializeProgramToEngineStores(
  serialized: SerializedProgramV1,
  options?: {
    onLog?: EngineObserver["onLog"];
    onPrompt?: EngineObserver["onPrompt"];
    signal?: AbortSignal;
    remoteExecutor?: RemoteExecutor;
    resolveSubflowTemplate?: SubflowTemplateResolver;
    maxSubflowDepth?: number;
  },
): EngineProgramStores {
  const { nodes, edges } = deserializeProgram(serialized);

  return buildEngineStoresFromFlowGraph({
    nodes: nodes as Node[],
    edges: edges as Edge[],
    onLog: options?.onLog,
    onPrompt: options?.onPrompt,
    signal: options?.signal,
    remoteExecutor: options?.remoteExecutor,
    resolveSubflowTemplate: options?.resolveSubflowTemplate,
    maxSubflowDepth: options?.maxSubflowDepth,
  });
}
