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
import { DataflowEngine } from "./engine";

import {
  EngineSumNode,
  EngineSubstractNode,
  EngineMultiplyNode,
  EngineDivideNode,
  EnginePowerNode,
  EngineConcatNode,
} from "./nodes/algorithm-nodes";
import { EngineConstantNode, EngineRandomNode } from "./nodes/input-nodes";
import { EngineTimerNode } from "./nodes/event-nodes";
import { EngineWriteNode } from "./nodes/output-nodes";
import {
  EngineAndNode,
  EngineComparisonNode,
  EngineNotNode,
  EngineOrNode,
  EngineSwitchNode,
} from "./nodes/logic-nodes";
import {
  EngineCountNode,
  EngineFilterNode,
  EngineGenerateSequenceNode,
  EngineMapNode,
  EngineReduceNode,
  EngineZipNode,
} from "./nodes/list-nodes";

export type EngineProgramStores = {
  nodeStore: NodeStore;
  arcStore: ArcStore;
};

function asRecord(value: unknown): Record<string, unknown> {
  return (
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  ) as Record<string, unknown>;
}

function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

function inputPortIds(def: NodeDefinition): string[] {
  return def.ports.slice(0, def.firePatterns.length);
}

function outputPortIds(def: NodeDefinition): string[] {
  return def.ports.slice(def.firePatterns.length);
}

function parseIndexHandle(handleId: string | null | undefined): number | null {
  if (!handleId) return null;
  const match = /-(\d+)$/.exec(handleId);
  if (!match) return null;
  const idx = Number(match[1]);
  return Number.isFinite(idx) ? idx : null;
}

function buildEngineStoresFromFlowGraph(params: {
  nodes: Node[];
  edges: Edge[];
}): EngineProgramStores {
  const nodeById = new Map<string, Node>();
  for (const node of params.nodes) {
    nodeById.set(String(node.id), node);
  }

  const nodeStore = new NodeStore();
  const arcStore = new ArcStore();

  for (const flowNode of params.nodes) {
    const engineDef = flowNodeToEngineDefinition(flowNode);
    nodeStore.addNode(new EngineNode(String(flowNode.id), engineDef.clone()));
  }

  for (const edge of params.edges) {
    const sourceId = String(edge.source);
    const targetId = String(edge.target);

    const sourceNode = nodeById.get(sourceId);
    const targetNode = nodeById.get(targetId);

    if (!sourceNode) {
      throw new Error(
        `Edge ${edge.id} references missing source node '${sourceId}'.`
      );
    }
    if (!targetNode) {
      throw new Error(
        `Edge ${edge.id} references missing target node '${targetId}'.`
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
        new PortAddress(targetId, targetPortId)
      )
    );
  }

  return { nodeStore, arcStore };
}

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
      : a.nodeId.localeCompare(b.nodeId)
  );

  return candidates[0] ?? null;
}

function compileSingleInputGraph(params: {
  graphNodes: Node[];
  graphEdges: Edge[];
  inputNodeId: string;
  inputPortId?: string;
  maxSteps?: number;
}): (value: unknown) => Promise<unknown> {
  const inputPortId = params.inputPortId ?? "input";

  // We compile to a nested engine execution. If compilation fails, fall back to identity.
  return async (value: unknown) => {
    try {
      const stores = buildEngineStoresFromFlowGraph({
        nodes: params.graphNodes,
        edges: params.graphEdges,
      });

      const engine = new DataflowEngine();
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

      if (!chosen) {
        return undefined;
      }

      const OUT_PORT = "result";
      const augmentedArcs = [
        ...engineArcs,
        new Arc(
          new PortAddress(chosen.nodeId, chosen.portId),
          new PortAddress("", OUT_PORT)
        ),
      ];

      engine.loadProgram({ nodes: engineNodes, arcs: augmentedArcs });
      const emitted = await engine.run({
        initialTokens: [
          new DataToken(
            value,
            new PortAddress(params.inputNodeId, inputPortId)
          ),
        ],
        maxSteps: params.maxSteps,
      });

      const result = emitted
        .filter(
          (t) => t.location.nodeId === "" && t.location.portId === OUT_PORT
        )
        .at(-1);

      return result?.value;
    } catch (err) {
      console.warn("Failed to compile/run inner graph:", err);
      return value;
    }
  };
}

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
    b: { nodeId: string; portId: string }
  ) =>
    a.nodeId === b.nodeId
      ? a.portId.localeCompare(b.portId)
      : a.nodeId.localeCompare(b.nodeId);

  openInputs.sort(byKey);
  openOutputs.sort(byKey);

  return { openInputs, openOutputs };
}

function compileSubflowNodeDefinition(params: {
  subflowNodes: Node[];
  subflowEdges: Edge[];
  inCount: number;
  outCount: number;
}): NodeDefinition {
  const stores = buildEngineStoresFromFlowGraph({
    nodes: params.subflowNodes,
    edges: params.subflowEdges,
  });

  const engineNodes = stores.nodeStore.getNodes();
  const engineArcs = stores.arcStore.getArcs();
  const { openInputs, openOutputs } = computeOpenPorts({
    nodes: engineNodes,
    arcs: engineArcs,
  });

  const selectedInputs = openInputs.slice(0, Math.max(0, params.inCount));
  const selectedOutputs = openOutputs.slice(0, Math.max(0, params.outCount));

  const firePatterns = selectedInputs.map(() => FirePatterns.EXISTS);
  const inputPorts = selectedInputs.map((_, idx) => `input${idx + 1}`);
  const outputPorts = selectedOutputs.map((_, idx) => `output${idx + 1}`);

  return new NodeDefinition(
    async (...args: unknown[]) => {
      const engine = new DataflowEngine();

      const augmentedArcs = [...engineArcs];
      for (let i = 0; i < selectedOutputs.length; i += 1) {
        const out = selectedOutputs[i];
        const portId = `out-${i + 1}`;
        augmentedArcs.push(
          new Arc(
            new PortAddress(out.nodeId, out.portId),
            new PortAddress("", portId)
          )
        );
      }

      engine.loadProgram({ nodes: engineNodes, arcs: augmentedArcs });

      const initialTokens = selectedInputs.map(
        (addr, idx) =>
          new DataToken(args[idx], new PortAddress(addr.nodeId, addr.portId))
      );

      const emitted = await engine.run({ initialTokens });

      const outputs: unknown[] = [];
      for (let i = 0; i < selectedOutputs.length; i += 1) {
        const portId = `out-${i + 1}`;
        const token = emitted
          .filter(
            (t) => t.location.nodeId === "" && t.location.portId === portId
          )
          .at(-1);
        outputs.push(token?.value);
      }

      return outputs;
    },
    firePatterns,
    [...inputPorts, ...outputPorts]
  );
}

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
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    throw new Error(
      `Node ${nodeId} (${nodeType}) should not have input connections.`
    );
  }

  if (nodeType === NODE_TYPES.SUBFLOW) {
    const idx = parseIndexHandle(handleId);
    if (direction === "target") {
      if (handleId?.startsWith("in-") && idx) return `input${idx}`;
      throw new Error(
        `Unknown input handle '${String(
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    if (handleId?.startsWith("out-") && idx) return `output${idx}`;
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
    );
  }

  // Input circle nodes: no explicit handle id -> output
  if (
    nodeType === NODE_TYPES.CONSTANT_INPUT ||
    nodeType === NODE_TYPES.RANDOM_INPUT ||
    nodeType === NODE_TYPES.TIMER_INPUT
  ) {
    if (direction === "source") {
      return "output";
    }
    throw new Error(
      `Node ${nodeId} (${nodeType}) should not have input connections.`
    );
  }

  // IO sink
  if (nodeType === NODE_TYPES.WRITE_SINK) {
    if (direction === "target") {
      return "input";
    }
    throw new Error(`Node ${nodeId} (${nodeType}) should not have outputs.`);
  }

  // Processing nodes (2-in 1-out)
  if (
    nodeType === NODE_TYPES.SUM_NODE ||
    nodeType === NODE_TYPES.SUBTRACT_NODE ||
    nodeType === NODE_TYPES.MULTIPLY_NODE ||
    nodeType === NODE_TYPES.DIVIDE_NODE ||
    nodeType === NODE_TYPES.POWER_NODE ||
    nodeType === NODE_TYPES.CONCAT_NODE
  ) {
    if (direction === "target") {
      if (handleId === "in-1") return "input1";
      if (handleId === "in-2") return "input2";
      throw new Error(
        `Unknown input handle '${String(
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
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
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
    );
  }

  if (nodeType === NODE_TYPES.NOT_NODE) {
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "input";
      throw new Error(
        `Unknown input handle '${String(
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    // UI currently exposes two outputs; map both to the same engine output.
    if (handleId === "out-1" || handleId === "out-2" || handleId == null) {
      return "output";
    }
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
    );
  }

  if (nodeType === NODE_TYPES.SWITCH_NODE) {
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "value";
      throw new Error(
        `Unknown input handle '${String(
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    if (handleId === "out-1") return "outputTrue";
    if (handleId === "out-2") return "outputFalse";
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
    );
  }

  // Iteration/list nodes
  if (nodeType === NODE_TYPES.ZIP_NODE) {
    if (direction === "target") {
      if (handleId === "in-1") return "listA";
      if (handleId === "in-2") return "listB";
      throw new Error(
        `Unknown input handle '${String(
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
    );
  }

  if (nodeType === NODE_TYPES.FILTER_NODE || nodeType === NODE_TYPES.MAP_NODE) {
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "inputList";
      throw new Error(
        `Unknown input handle '${String(
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    if (handleId === "out" || handleId == null) return "outputList";
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
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
          handleId
        )}' for node ${nodeId} (${nodeType}).`
      );
    }

    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
    );
  }

  if (nodeType === NODE_TYPES.GENERATE_SEQUENCE_NODE) {
    if (direction === "target") {
      throw new Error(
        `Node ${nodeId} (${nodeType}) does not accept inputs in the engine model.`
      );
    }
    if (handleId === "out" || handleId == null) return "output";
    throw new Error(
      `Unknown output handle '${String(
        handleId
      )}' for node ${nodeId} (${nodeType}).`
    );
  }

  throw new Error(
    `Unsupported node type '${String(nodeType)}' for node ${nodeId}.`
  );
}

function flowNodeToEngineDefinition(flowNode: Node): NodeDefinition {
  const nodeType = flowNode.type;
  const data = asRecord(flowNode.data);

  switch (nodeType) {
    case NODE_TYPES.CONSTANT_INPUT: {
      const value = data.value as number | string | boolean | undefined;
      return new EngineConstantNode(value ?? 0);
    }
    case NODE_TYPES.RANDOM_INPUT: {
      const min = typeof data.min === "number" ? data.min : 0;
      const max = typeof data.max === "number" ? data.max : 100;
      return new EngineRandomNode(min, max);
    }
    case NODE_TYPES.TIMER_INPUT: {
      // UI stores seconds; engine expects milliseconds.
      const seconds = typeof data.timeValue === "number" ? data.timeValue : 0;
      return new EngineTimerNode(Math.max(0, Math.round(seconds * 1000)));
    }

    case NODE_TYPES.FILTER_INPUT_VALUE:
    case NODE_TYPES.MAP_INPUT_VALUE: {
      // Pass-through for the "Valor de entrada" node inside embedded editors.
      return new NodeDefinition(
        (v: unknown) => v,
        [FirePatterns.EXISTS],
        ["input", "output"]
      );
    }

    case NODE_TYPES.SUM_NODE:
      return new EngineSumNode();
    case NODE_TYPES.SUBTRACT_NODE:
      return new EngineSubstractNode();
    case NODE_TYPES.MULTIPLY_NODE:
      return new EngineMultiplyNode();
    case NODE_TYPES.DIVIDE_NODE:
      return new EngineDivideNode();
    case NODE_TYPES.POWER_NODE:
      return new EnginePowerNode();
    case NODE_TYPES.CONCAT_NODE:
      return new EngineConcatNode();

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
      return new EngineSwitchNode((v) => Boolean(v));
    }

    case NODE_TYPES.WRITE_SINK:
      return new EngineWriteNode();

    case NODE_TYPES.GENERATE_SEQUENCE_NODE: {
      const min = typeof data.min === "number" ? data.min : 0;
      const max = typeof data.max === "number" ? data.max : 100;
      const step =
        typeof data.step === "number" && data.step > 0 ? data.step : 1;
      return new EngineGenerateSequenceNode(min, max, step);
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
        });

        return new EngineFilterNode(async (item: unknown) =>
          Boolean(await runPredicate(item))
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
        });

        return new EngineMapNode(
          async (item: unknown) => await runMapper(item)
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
      const inCount = typeof data.inCount === "number" ? data.inCount : 0;
      const outCount = typeof data.outCount === "number" ? data.outCount : 0;

      if (Array.isArray(subflowNodes) && Array.isArray(subflowEdges)) {
        return compileSubflowNodeDefinition({
          subflowNodes: subflowNodes as Node[],
          subflowEdges: subflowEdges as Edge[],
          inCount,
          outCount,
        });
      }

      throw new Error(
        `Subflow node '${String(
          flowNode.id
        )}' is missing subflowNodes/subflowEdges.`
      );
    }

    default:
      throw new Error(
        `Unsupported node type '${String(
          nodeType
        )}' for engine deserialization (node id: ${flowNode.id}).`
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
  serialized: SerializedProgramV1
): EngineProgramStores {
  const { nodes, edges } = deserializeProgram(serialized);

  return buildEngineStoresFromFlowGraph({
    nodes: nodes as Node[],
    edges: edges as Edge[],
  });
}
