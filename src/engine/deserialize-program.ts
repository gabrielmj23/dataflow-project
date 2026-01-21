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

import {
  EngineSumNode,
  EngineSubstractNode,
  EngineMultiplyNode,
  EngineDivideNode,
  EngineModNode,
  EnginePowerNode,
  EngineFloorNode,
  EngineCeilingNode,
  EngineRoundNode,
  EngineFormulaNode,
  EngineConcatNode,
} from "./nodes/algorithm-nodes";
import { EngineConstantNode, EngineRandomNode } from "./nodes/input-nodes";
import { EngineTimerNode } from "./nodes/event-nodes";
import { EngineWriteNode } from "./nodes/output-nodes";
import { EngineMicrobitReadButtonNode } from "./nodes/microbit-nodes";
import {
  EngineMicrobitCeilingNode,
  EngineMicrobitConcatNode,
  EngineMicrobitDivideNode,
  EngineMicrobitFloorNode,
  EngineMicrobitModNode,
  EngineMicrobitMultiplyNode,
  EngineMicrobitPowerNode,
  EngineMicrobitRoundNode,
  EngineMicrobitSoundNode,
  EngineMicrobitSubtractNode,
  EngineMicrobitSumNode,
  EngineMicrobitWriteNode,
} from "./nodes/microbit-nodes";
import {
  EngineAndNode,
  EngineComparisonNode,
  EngineNotNode,
  EngineOrNode,
  EngineSwitchNode,
} from "./nodes/logic-nodes";
import type { SwitchCondition, SwitchOperator } from "./nodes/logic-nodes";
import {
  EngineCountNode,
  EngineFilterNode,
  EngineGenerateSequenceNode,
  EnginePulseSequenceNode,
  EngineMapNode,
  EngineReduceNode,
  EngineZipNode,
} from "./nodes/list-nodes";

export type EngineProgramStores = {
  nodeStore: NodeStore;
  arcStore: ArcStore;
};

/**
 * Safely coerces an unknown value into a plain record.
 *
 * This is used to read `node.data` coming from the UI graph, which may be
 * `undefined`, `null`, or any other JSON value.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return (
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  ) as Record<string, unknown>;
}

/**
 * Type guard that checks if a value is an array with at least one element.
 */
function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

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
 * Parses an XYFlow handle id that ends with "-<n>".
 *
 * Examples:
 * - "in-1" -> 1
 * - "out-2" -> 2
 *
 * Returns `null` when the format doesn't match.
 */
function parseIndexHandle(handleId: string | null | undefined): number | null {
  if (!handleId) return null;
  const match = /-(\d+)$/.exec(handleId);
  if (!match) return null;
  const idx = Number(match[1]);
  return Number.isFinite(idx) ? idx : null;
}

/**
 * Builds engine stores from a UI graph (XYFlow nodes and edges).
 *
 * Responsibilities:
 * - Converts each UI node into an engine `NodeDefinition`.
 * - Converts each UI edge into an engine `Arc`, mapping UI handles to
 *   engine port IDs.
 */
function buildEngineStoresFromFlowGraph(params: {
  nodes: Node[];
  edges: Edge[];
  onLog?: EngineObserver["onLog"];
  onPrompt?: EngineObserver["onPrompt"];
  signal?: AbortSignal;
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
  for (const edge of params.edges) {
    const targetId = String(edge.target);
    const targetNode = nodeById.get(targetId);
    if (!targetNode) continue;

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

    if (targetNode.type !== NODE_TYPES.WRITE_SINK) continue;

    const handleId = edge.targetHandle ?? null;
    const idx = handleId == null ? 1 : (parseIndexHandle(handleId) ?? 1);
    const current = writeSinkInputCountByNodeId.get(targetId) ?? 1;
    writeSinkInputCountByNodeId.set(targetId, Math.max(current, idx));
  }

  const nodeStore = new NodeStore();
  const arcStore = new ArcStore();

  for (const flowNode of uiNodes) {
    const engineDef = flowNodeToEngineDefinition(flowNode, {
      writeSinkInputCountByNodeId,
      timerHasIncomingByNodeId,
      sequenceIncomingByNodeId,
      pulseSequenceIncomingByNodeId,
      onLog: params.onLog,
      onPrompt: params.onPrompt,
      signal: params.signal,
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

      const engine = new DataflowEngine();
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
}): NodeDefinition {
  const stores = buildEngineStoresFromFlowGraph({
    nodes: params.subflowNodes,
    edges: params.subflowEdges,
    onLog: params.onLog,
    onPrompt: params.onPrompt,
    signal: params.signal,
  });

  const engineNodes = stores.nodeStore.getNodes();
  const engineArcs = stores.arcStore.getArcs();
  const { openInputs, openOutputs } = computeOpenPorts({
    nodes: engineNodes,
    arcs: engineArcs,
  });

  const selectedInputs =
    typeof params.inCount === "number"
      ? openInputs.slice(0, Math.max(0, params.inCount))
      : openInputs;

  const selectedOutputs =
    typeof params.outCount === "number"
      ? openOutputs.slice(0, Math.max(0, params.outCount))
      : openOutputs;

  const firePatterns = selectedInputs.map(() => FirePatterns.EXISTS);
  const inputPorts = selectedInputs.map((_, idx) => `input${idx + 1}`);
  const outputPorts = selectedOutputs.map((_, idx) => `output${idx + 1}`);

  return new NodeDefinition(
    async (...args: unknown[]) => {
      const engine = new DataflowEngine();
      if (params.onLog || params.onPrompt) {
        engine.setObserver({
          onLog: params.onLog,
          onPrompt: params.onPrompt,
        });
      }

      const augmentedArcs = [...engineArcs];
      for (let i = 0; i < selectedOutputs.length; i += 1) {
        const out = selectedOutputs[i];
        const portId = `out-${i + 1}`;
        augmentedArcs.push(
          new Arc(
            new PortAddress(out.nodeId, out.portId),
            new PortAddress("", portId),
          ),
        );
      }

      engine.loadProgram({ nodes: engineNodes, arcs: augmentedArcs });

      const initialTokens = selectedInputs.map(
        (addr, idx) =>
          new DataToken(args[idx], new PortAddress(addr.nodeId, addr.portId)),
      );

      const emitted = await engine.run({
        initialTokens,
        signal: params.signal,
      });

      const outputs: unknown[] = [];
      for (let i = 0; i < selectedOutputs.length; i += 1) {
        const portId = `out-${i + 1}`;
        const token = emitted
          .filter(
            (t) => t.location.nodeId === "" && t.location.portId === portId,
          )
          .at(-1);
        outputs.push(token?.value);
      }

      // For 1-output subflows, behave like any other single-output node and
      // return the value directly. This avoids nested arrays when subflows are
      // used as mappers/predicates (e.g., Map -> Subflow "Cuadrado").
      if (selectedOutputs.length === 1) {
        return outputs[0];
      }

      return outputs;
    },
    firePatterns,
    [...inputPorts, ...outputPorts],
  );
}

/**
 * Maps a UI handle ID (XYFlow) into an engine port ID.
 *
 * This function encodes the contract between the visual nodes (their handle
 * IDs) and the engine node definitions (their port names).
 */
function mapHandleToPortId(params: {
  nodeId: string;
  nodeType?: string;
  handleId?: string | null;
  direction: "source" | "target";
}): string {
  const { nodeId, nodeType, handleId, direction } = params;

  // Internal "input value" nodes (used inside Map/Filter embedded editors)
  if (
    nodeType === NODE_TYPES.FILTER_INPUT_VALUE ||
    nodeType === NODE_TYPES.MAP_INPUT_VALUE
  ) {
    if (direction === "source") {
      if (handleId === "value" || handleId == null) return "output";
      throw new Error(
        `Unknown output handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    throw new Error(
      `Node ${nodeId} (${nodeType}) should not have input connections.`,
    );
  }

  if (nodeType === NODE_TYPES.SUBFLOW) {
    const idx = parseIndexHandle(handleId);
    if (direction === "target") {
      if (handleId?.startsWith("in-") && idx) return `input${idx}`;
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId?.startsWith("out-") && idx) return `output${idx}`;
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  // Input circle nodes: no explicit handle id -> output
  if (
    nodeType === NODE_TYPES.CONSTANT_INPUT ||
    nodeType === NODE_TYPES.CONSTANT_NUMBER_INPUT ||
    nodeType === NODE_TYPES.CONSTANT_BOOLEAN_INPUT ||
    nodeType === NODE_TYPES.CONSTANT_TEXT_INPUT ||
    nodeType === NODE_TYPES.RUNTIME_INPUT ||
    nodeType === NODE_TYPES.RANDOM_INPUT ||
    nodeType === NODE_TYPES.MICROBIT_READ_BUTTON_INPUT
  ) {
    if (direction === "source") {
      return "output";
    }
    throw new Error(
      `Node ${nodeId} (${nodeType}) should not have input connections.`,
    );
  }

  // Timer: inputOutput circle node (optional input -> output after delay)
  if (nodeType === NODE_TYPES.TIMER_INPUT) {
    if (direction === "target") {
      if (handleId == null) return "input";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  // IO sink
  if (nodeType === NODE_TYPES.WRITE_SINK) {
    if (direction === "target") {
      if (handleId == null) return "input1";
      const idx = parseIndexHandle(handleId);
      if (handleId.startsWith("in-") && idx) return `input${idx}`;
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }
    throw new Error(`Node ${nodeId} (${nodeType}) should not have outputs.`);
  }

  // micro:bit sinks (no-op for now)
  if (
    nodeType === NODE_TYPES.MICROBIT_WRITE ||
    nodeType === NODE_TYPES.MICROBIT_SOUND
  ) {
    if (direction === "target") {
      if (handleId == null) return "input1";
      const idx = parseIndexHandle(handleId);
      if (handleId.startsWith("in-") && idx) return `input${idx}`;
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }
    throw new Error(`Node ${nodeId} (${nodeType}) should not have outputs.`);
  }

  // Formula editor (dynamic inputs)
  if (nodeType === NODE_TYPES.FORMULA_EDITOR_NODE) {
    if (direction === "target") {
      const idx = parseIndexHandle(handleId);
      if (handleId?.startsWith("in-") && idx) return `input${idx}`;
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  // Processing nodes (2-in 1-out)
  if (
    nodeType === NODE_TYPES.SUM_NODE ||
    nodeType === NODE_TYPES.SUBTRACT_NODE ||
    nodeType === NODE_TYPES.MULTIPLY_NODE ||
    nodeType === NODE_TYPES.DIVIDE_NODE ||
    nodeType === NODE_TYPES.MOD_NODE ||
    nodeType === NODE_TYPES.POWER_NODE ||
    nodeType === NODE_TYPES.CONCAT_NODE
  ) {
    if (direction === "target") {
      if (handleId === "in-1") return "input1";
      if (handleId === "in-2") return "input2";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  // Processing nodes (1-in 1-out)
  if (
    nodeType === NODE_TYPES.FLOOR_NODE ||
    nodeType === NODE_TYPES.CEILING_NODE ||
    nodeType === NODE_TYPES.ROUND_NODE
  ) {
    if (direction === "target") {
      if (handleId === "in-1") return "input1";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  // Control nodes
  if (
    nodeType === NODE_TYPES.COMPARISON_NODE ||
    nodeType === NODE_TYPES.AND_NODE ||
    nodeType === NODE_TYPES.OR_NODE
  ) {
    if (direction === "target") {
      if (handleId === "in-1") return "input1";
      if (handleId === "in-2") return "input2";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  if (nodeType === NODE_TYPES.NOT_NODE) {
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "input";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out") {
      return "output";
    }
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  if (nodeType === NODE_TYPES.SWITCH_NODE) {
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "value";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out-default") return "outputDefault";

    const idx = parseIndexHandle(handleId);
    if (handleId?.startsWith("out-") && idx) return `output${idx}`;
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  // Iteration/list nodes
  if (nodeType === NODE_TYPES.ZIP_NODE) {
    if (direction === "target") {
      if (handleId === "in-1") return "listA";
      if (handleId === "in-2") return "listB";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  if (nodeType === NODE_TYPES.FILTER_NODE || nodeType === NODE_TYPES.MAP_NODE) {
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "inputList";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out" || handleId == null) return "outputList";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  if (
    nodeType === NODE_TYPES.COUNT_NODE ||
    nodeType === NODE_TYPES.REDUCE_NODE
  ) {
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "inputList";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  if (
    nodeType === NODE_TYPES.GENERATE_SEQUENCE_NODE ||
    nodeType === NODE_TYPES.PULSE_SEQUENCE_NODE
  ) {
    if (direction === "target") {
      if (handleId === "in-1" || handleId == null) return "start";
      if (handleId === "in-2") return "end";
      if (handleId === "in-3") return "step";
      throw new Error(
        `Unknown input handle '${String(
          handleId,
        )}' for node ${nodeId} (${nodeType}).`,
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId,
      )}' for node ${nodeId} (${nodeType}).`,
    );
  }

  throw new Error(
    `Unsupported node type '${String(nodeType)}' for node ${nodeId}.`,
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
    onLog?: EngineObserver["onLog"];
    onPrompt?: EngineObserver["onPrompt"];
    signal?: AbortSignal;
  },
): NodeDefinition {
  const nodeType = flowNode.type;
  const data = asRecord(flowNode.data);

  switch (nodeType) {
    case NODE_TYPES.CONSTANT_INPUT: {
      const value = data.value as number | string | boolean | undefined;
      return new EngineConstantNode(value ?? 0);
    }
    case NODE_TYPES.CONSTANT_NUMBER_INPUT: {
      const value = typeof data.value === "number" ? data.value : 0;
      return new EngineConstantNode(value);
    }
    case NODE_TYPES.CONSTANT_BOOLEAN_INPUT: {
      const value = data.value === true;
      return new EngineConstantNode(value);
    }
    case NODE_TYPES.CONSTANT_TEXT_INPUT: {
      const value = typeof data.value === "string" ? data.value : "";
      return new EngineConstantNode(value);
    }
    case NODE_TYPES.RUNTIME_INPUT: {
      const prompt = typeof data.prompt === "string" ? data.prompt : undefined;
      const valueTypeRaw = data.valueType;
      const valueType = valueTypeRaw === "text" ? "text" : "number";

      const defaultValue =
        valueType === "text"
          ? typeof data.defaultValue === "string"
            ? data.defaultValue
            : undefined
          : typeof data.defaultValue === "number"
            ? data.defaultValue
            : undefined;

      return new NodeDefinition(
        () => defaultValue ?? (valueType === "text" ? "" : 0),
        [FirePatterns.ALWAYS],
        ["output"],
        {
          kind: "runtimeInput",
          runtimePrompt: prompt,
          runtimeInputType: valueType,
          runtimeDefaultValue: defaultValue,
        },
      );
    }
    case NODE_TYPES.RANDOM_INPUT: {
      const min = typeof data.min === "number" ? data.min : 0;
      const max = typeof data.max === "number" ? data.max : 100;
      const integerOnly = data.integerOnly === true;
      return new EngineRandomNode(min, max, integerOnly);
    }
    case NODE_TYPES.TIMER_INPUT: {
      // UI stores seconds; engine expects milliseconds.
      const seconds = typeof data.timeValue === "number" ? data.timeValue : 0;
      const hasIncoming = Boolean(
        context?.timerHasIncomingByNodeId?.get(String(flowNode.id)),
      );
      return new EngineTimerNode(
        Math.max(0, Math.round(seconds * 1000)),
        hasIncoming ? "delay" : "source",
      );
    }

    case NODE_TYPES.MICROBIT_READ_BUTTON_INPUT: {
      const transportRaw = data.transport;
      const transport =
        transportRaw === "bluetooth" || transportRaw === "serial"
          ? transportRaw
          : "serial";
      return new EngineMicrobitReadButtonNode({
        nodeId: String(flowNode.id),
        transport,
        onLog: context?.onLog,
        signal: context?.signal,
      });
    }

    case NODE_TYPES.FILTER_INPUT_VALUE:
    case NODE_TYPES.MAP_INPUT_VALUE: {
      // Pass-through for the "Valor de entrada" node inside embedded editors.
      return new NodeDefinition(
        (v: unknown) => v,
        [FirePatterns.EXISTS],
        ["input", "output"],
      );
    }

    case NODE_TYPES.SUM_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitSumNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineSumNode();
    }
    case NODE_TYPES.SUBTRACT_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitSubtractNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineSubstractNode();
    }
    case NODE_TYPES.MULTIPLY_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitMultiplyNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineMultiplyNode();
    }
    case NODE_TYPES.DIVIDE_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitDivideNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineDivideNode();
    }
    case NODE_TYPES.MOD_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitModNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineModNode();
    }
    case NODE_TYPES.POWER_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitPowerNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EnginePowerNode();
    }
    case NODE_TYPES.FLOOR_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitFloorNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineFloorNode();
    }
    case NODE_TYPES.CEILING_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitCeilingNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineCeilingNode();
    }
    case NODE_TYPES.ROUND_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitRoundNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineRoundNode();
    }
    case NODE_TYPES.FORMULA_EDITOR_NODE: {
      const formula = data.formula;
      const variables = data.variables;
      return new EngineFormulaNode({ formula, variables });
    }
    case NODE_TYPES.CONCAT_NODE: {
      const executionTarget = data.executionTarget;
      if (executionTarget === "microbit") {
        const transportRaw = data.transport ?? data.connectionType;
        const transport =
          transportRaw === "bluetooth" || transportRaw === "serial"
            ? transportRaw
            : "serial";
        return new EngineMicrobitConcatNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: context?.onLog,
          signal: context?.signal,
        });
      }
      return new EngineConcatNode();
    }

    case NODE_TYPES.COMPARISON_NODE: {
      const operator = data.operator;
      const op =
        operator === "==" ||
        operator === "!=" ||
        operator === "<" ||
        operator === "<=" ||
        operator === ">" ||
        operator === ">="
          ? operator
          : "==";
      return new EngineComparisonNode(op);
    }
    case NODE_TYPES.AND_NODE:
      return new EngineAndNode();
    case NODE_TYPES.OR_NODE:
      return new EngineOrNode();
    case NODE_TYPES.NOT_NODE:
      return new EngineNotNode();

    case NODE_TYPES.SWITCH_NODE: {
      const raw = data.conditions;

      const conditions: SwitchCondition[] = Array.isArray(raw)
        ? raw
            .map((c) =>
              c && typeof c === "object"
                ? (c as Record<string, unknown>)
                : null,
            )
            .filter((c): c is Record<string, unknown> => Boolean(c))
            .map((c): SwitchCondition => {
              const operator = c.operator;
              const target = c.target;

              const op: SwitchOperator =
                operator === "==" ||
                operator === "!=" ||
                operator === ">" ||
                operator === ">=" ||
                operator === "<" ||
                operator === "<=" ||
                operator === "contains" ||
                operator === "startsWith" ||
                operator === "endsWith" ||
                operator === "truthy" ||
                operator === "falsy"
                  ? operator
                  : "truthy";

              return {
                operator: op,
                target,
              };
            })
        : [];

      return new EngineSwitchNode(
        conditions.length > 0
          ? conditions
          : [{ operator: "truthy" }, { operator: "falsy" }],
      );
    }

    case NODE_TYPES.WRITE_SINK:
      return new EngineWriteNode(
        context?.writeSinkInputCountByNodeId?.get(String(flowNode.id)) ?? 1,
        typeof data.template === "string" ? data.template : undefined,
      );

    case NODE_TYPES.MICROBIT_WRITE:
      return new EngineMicrobitWriteNode({
        transport:
          (data as { transport?: unknown; connectionType?: unknown } | null)
            ?.transport ??
          (data as { connectionType?: unknown } | null)?.connectionType,
      });

    case NODE_TYPES.MICROBIT_SOUND:
      return new EngineMicrobitSoundNode({
        transport:
          (data as { transport?: unknown; connectionType?: unknown } | null)
            ?.transport ??
          (data as { connectionType?: unknown } | null)?.connectionType,
      });

    case NODE_TYPES.GENERATE_SEQUENCE_NODE: {
      const incoming = context?.sequenceIncomingByNodeId?.get(
        String(flowNode.id),
      ) ?? {
        start: false,
        end: false,
        step: false,
      };

      const firePatterns: [FirePatterns, FirePatterns, FirePatterns] = [
        incoming.start ? FirePatterns.EXISTS : FirePatterns.DONT_CARE,
        incoming.end ? FirePatterns.EXISTS : FirePatterns.DONT_CARE,
        incoming.step ? FirePatterns.EXISTS : FirePatterns.DONT_CARE,
      ];

      return new EngineGenerateSequenceNode({
        defaultStart: 1,
        defaultEnd: 10,
        defaultStep: 1,
        firePatterns,
      });
    }
    case NODE_TYPES.PULSE_SEQUENCE_NODE: {
      const incoming = context?.pulseSequenceIncomingByNodeId?.get(
        String(flowNode.id),
      ) ?? {
        start: false,
        end: false,
        step: false,
      };

      const firePatterns: [FirePatterns, FirePatterns, FirePatterns] = [
        incoming.start ? FirePatterns.EXISTS : FirePatterns.DONT_CARE,
        incoming.end ? FirePatterns.EXISTS : FirePatterns.DONT_CARE,
        incoming.step ? FirePatterns.EXISTS : FirePatterns.DONT_CARE,
      ];

      return new EnginePulseSequenceNode({
        defaultStart: 1,
        defaultEnd: 10,
        defaultStep: 1,
        firePatterns,
      });
    }
    case NODE_TYPES.ZIP_NODE:
      return new EngineZipNode();

    case NODE_TYPES.FILTER_NODE: {
      const filterNodes = data.filterNodes;
      const filterEdges = data.filterEdges;

      if (isNonEmptyArray<Node>(filterNodes) && Array.isArray(filterEdges)) {
        const runPredicate = compileSingleInputGraph({
          graphNodes: filterNodes,
          graphEdges: filterEdges as Edge[],
          inputNodeId: "filter-input-value",
          onLog: context?.onLog,
          onPrompt: context?.onPrompt,
          signal: context?.signal,
        });

        return new EngineFilterNode(async (item: unknown) =>
          Boolean(await runPredicate(item)),
        );
      }

      return new EngineFilterNode((item: unknown) => Boolean(item));
    }

    case NODE_TYPES.MAP_NODE: {
      const mapNodes = data.mapNodes;
      const mapEdges = data.mapEdges;

      if (isNonEmptyArray<Node>(mapNodes) && Array.isArray(mapEdges)) {
        const runMapper = compileSingleInputGraph({
          graphNodes: mapNodes,
          graphEdges: mapEdges as Edge[],
          inputNodeId: "map-input-value",
          onLog: context?.onLog,
          onPrompt: context?.onPrompt,
          signal: context?.signal,
        });

        return new EngineMapNode(
          async (item: unknown) => await runMapper(item),
        );
      }

      return new EngineMapNode((item: unknown) => item);
    }

    case NODE_TYPES.REDUCE_NODE: {
      // Default accumulate: sum of list (reduce with +, initial 0)
      return new EngineReduceNode((acc, curr) => acc + curr, 0);
    }

    case NODE_TYPES.COUNT_NODE:
      return new EngineCountNode();

    case NODE_TYPES.SUBFLOW: {
      const subflowNodes = data.subflowNodes;
      const subflowEdges = data.subflowEdges;
      // IMPORTANT: When `inCount/outCount` are missing, defaulting to 0 would
      // drop all inputs/outputs, causing subflows to run with no initial tokens
      // and produce `undefined` outputs.
      // If the user explicitly configured 0 inputs/outputs, we keep that.
      const inCount =
        typeof data.inCount === "number" ? data.inCount : undefined;
      const outCount =
        typeof data.outCount === "number" ? data.outCount : undefined;

      if (Array.isArray(subflowNodes) && Array.isArray(subflowEdges)) {
        return compileSubflowNodeDefinition({
          subflowNodes: subflowNodes as Node[],
          subflowEdges: subflowEdges as Edge[],
          inCount,
          outCount,
          onLog: context?.onLog,
          onPrompt: context?.onPrompt,
          signal: context?.signal,
        });
      }

      throw new Error(
        `Subflow node '${String(
          flowNode.id,
        )}' is missing subflowNodes/subflowEdges.`,
      );
    }

    default:
      throw new Error(
        `Unsupported node type '${String(
          nodeType,
        )}' for engine deserialization (node id: ${flowNode.id}).`,
      );
  }
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
  },
): EngineProgramStores {
  const { nodes, edges } = deserializeProgram(serialized);

  return buildEngineStoresFromFlowGraph({
    nodes: nodes as Node[],
    edges: edges as Edge[],
    onLog: options?.onLog,
    onPrompt: options?.onPrompt,
    signal: options?.signal,
  });
}
