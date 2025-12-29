import type { Node } from "@xyflow/react";

import type { SerializedProgramV1 } from "@/flow/serialization";
import { deserializeProgram } from "@/flow/serialization";
import { NODE_TYPES } from "@/common/constants";

import {
  Arc,
  Node as EngineNode,
  PortAddress,
  type NodeDefinition,
} from "./program-elements";
import { ArcStore, NodeStore } from "./stores";

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

function mapHandleToPortId(params: {
  nodeId: string;
  nodeType?: string;
  handleId?: string | null;
  direction: "source" | "target";
}): string {
  const { nodeId, nodeType, handleId, direction } = params;

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
    case "constantInput": {
      const value = data.value as number | string | boolean | undefined;
      return new EngineConstantNode(value ?? 0);
    }
    case "randomInput": {
      const min = typeof data.min === "number" ? data.min : 0;
      const max = typeof data.max === "number" ? data.max : 100;
      return new EngineRandomNode(min, max);
    }
    case "timerInput": {
      // UI stores seconds; engine expects milliseconds.
      const seconds = typeof data.timeValue === "number" ? data.timeValue : 0;
      return new EngineTimerNode(Math.max(0, Math.round(seconds * 1000)));
    }

    case "sum":
      return new EngineSumNode();
    case "subtract":
      return new EngineSubstractNode();
    case "multiply":
      return new EngineMultiplyNode();
    case "divide":
      return new EngineDivideNode();
    case "power":
      return new EnginePowerNode();
    case "concat":
      return new EngineConcatNode();

    case "comparison": {
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
    case "and":
      return new EngineAndNode();
    case "or":
      return new EngineOrNode();
    case "not":
      return new EngineNotNode();
    case "switch": {
      // TODO: allow configuring condition via node.data; for now, treat truthy as true.
      return new EngineSwitchNode((v) => Boolean(v));
    }

    case "write":
      return new EngineWriteNode();

    case "sequence": {
      const min = typeof data.min === "number" ? data.min : 0;
      const max = typeof data.max === "number" ? data.max : 100;
      const step =
        typeof data.step === "number" && data.step > 0 ? data.step : 1;
      return new EngineGenerateSequenceNode(min, max, step);
    }
    case "zip":
      return new EngineZipNode();
    case "filter": {
      // TODO: compile predicate graph from filterNodes/filterEdges.
      // Current placeholder keeps items that are truthy.
      return new EngineFilterNode((item) => Boolean(item));
    }
    case "map": {
      // TODO: compile map graph from mapNodes/mapEdges.
      // Current placeholder is identity.
      return new EngineMapNode((item) => item);
    }
    case "accumulate": {
      // Default accumulate: sum of list (reduce with +, initial 0)
      return new EngineReduceNode((acc, curr) => acc + curr, 0);
    }
    case "count":
      return new EngineCountNode();

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

  const nodeById = new Map<string, Node>();
  for (const node of nodes) {
    nodeById.set(String(node.id), node);
  }

  const nodeStore = new NodeStore();
  const arcStore = new ArcStore();

  // Build engine nodes first
  for (const flowNode of nodes) {
    const engineDef = flowNodeToEngineDefinition(flowNode);
    nodeStore.addNode(new EngineNode(String(flowNode.id), engineDef.clone()));
  }

  // Then build arcs (requires node type for handle mapping)
  for (const edge of edges) {
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
