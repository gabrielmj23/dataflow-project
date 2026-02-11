import type { Edge, Node } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";
import { ensureMicrobitConnected } from "@/microbit/connection-manager";
import { sendSubflowToMicrobit } from "@/microbit/subflow-sender";

import {
  EngineCountNode,
  EngineFilterNode,
  EngineGenerateSequenceNode,
  EngineMapNode,
  EnginePulseSequenceNode,
  EngineReduceNode,
  EngineSortListNode,
  EngineZipNode,
  EngineUnzipNode,
} from "../nodes/list-nodes";
import { EngineGatherNode, EngineScatterNode } from "../nodes/control-nodes";
import {
  DataToken,
  FirePatterns,
  NodeDefinition,
  PortAddress,
} from "../program-elements";

import { asRecord, isNonEmptyArray } from "../deserialize/utils";
import type { NodeCompiler } from "./types";

function parseTransport(data: Record<string, unknown>): "serial" | "bluetooth" {
  const transportRaw = (data.transport ?? data.connectionType) as unknown;
  return transportRaw === "bluetooth" || transportRaw === "serial"
    ? transportRaw
    : "serial";
}

function sanitizeProgramId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 32);
}

function buildMicrobitListGraph(params: {
  nodeId: string;
  nodeType: string;
  nodeData: Record<string, unknown>;
  inputHandles: string[];
  outputPortId: string;
}): {
  nodes: Node[];
  edges: Edge[];
  selectedInputs: Array<{ nodeId: string; portId: string }>;
  outputSources: Array<{ nodeId: string; portId: string }>;
  programId: string;
} {
  const inputNodes = params.inputHandles.map((_ , index) => ({
    id: `mb-${params.nodeId}-in-${index + 1}`,
    type: NODE_TYPES.SUBFLOW_INPUT,
    position: { x: 0, y: index * 120 },
    data: { label: `Input ${index + 1}` },
  }));

  const opNodeId = `mb-${params.nodeId}-op`;
  const opNode: Node = {
    id: opNodeId,
    type: params.nodeType,
    position: { x: 180, y: 0 },
    data: params.nodeData,
  };

  const edges: Edge[] = params.inputHandles.map((handleId, index) => ({
    id: `mb-${params.nodeId}-e-${index + 1}`,
    source: inputNodes[index].id,
    target: opNodeId,
    sourceHandle: "value",
    targetHandle: handleId,
  }));

  const selectedInputs = inputNodes.map((node) => ({
    nodeId: String(node.id),
    portId: "input",
  }));

  const outputSources = [
    {
      nodeId: opNodeId,
      portId: params.outputPortId,
    },
  ];

  const programId = sanitizeProgramId(
    `${params.nodeId}-${params.outputPortId}`,
  );

  return {
    nodes: [...inputNodes, opNode],
    edges,
    selectedInputs,
    outputSources,
    programId,
  };
}

export const compileListNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);
  const executionTarget = data.executionTarget;

  switch (nodeType) {
    case NODE_TYPES.GENERATE_SEQUENCE_NODE: {
      const incoming = ctx.sequenceIncomingByNodeId?.get(
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
      const incoming = ctx.pulseSequenceIncomingByNodeId?.get(
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

    case NODE_TYPES.ZIP_NODE: {
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (listA: unknown[], listB: unknown[]) => {
            const connection = await ensureMicrobitConnected({ transport });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [listA, listB],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["listA", "listB", "output"],
          {
            stickyInputPorts: ["listA", "listB"],
          },
        );
      }

      return new EngineZipNode();
    }

    case NODE_TYPES.UNZIP_NODE: {
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graphA = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "listA",
        });
        const graphB = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "listB",
        });

        return new NodeDefinition(
          async (inputList: unknown[]) => {
            const connection = await ensureMicrobitConnected({ transport });
            const listA = await sendSubflowToMicrobit({
              connection,
              nodes: graphA.nodes,
              edges: graphA.edges,
              selectedInputs: graphA.selectedInputs,
              outputSources: graphA.outputSources,
              args: [inputList],
              programId: graphA.programId,
              signal: ctx.signal,
            });
            const listB = await sendSubflowToMicrobit({
              connection,
              nodes: graphB.nodes,
              edges: graphB.edges,
              selectedInputs: graphB.selectedInputs,
              outputSources: graphB.outputSources,
              args: [inputList],
              programId: graphB.programId,
              signal: ctx.signal,
            });

            return [
              new DataToken(listA, new PortAddress("", "listA")),
              new DataToken(listB, new PortAddress("", "listB")),
            ];
          },
          [FirePatterns.EXISTS],
          ["inputList", "listA", "listB"],
          {
            stickyInputPorts: ["inputList"],
          },
        );
      }

      return new EngineUnzipNode();
    }

    case NODE_TYPES.FILTER_NODE: {
      const filterNodes = data.filterNodes;
      const filterEdges = data.filterEdges;

      if (isNonEmptyArray<Node>(filterNodes) && Array.isArray(filterEdges)) {
        const runPredicate = ctx.helpers.compileSingleInputGraph({
          graphNodes: filterNodes,
          graphEdges: filterEdges as Edge[],
          inputNodeId: "filter-input-value",
          onLog: ctx.onLog,
          onPrompt: ctx.onPrompt,
          signal: ctx.signal,
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
        const runMapper = ctx.helpers.compileSingleInputGraph({
          graphNodes: mapNodes,
          graphEdges: mapEdges as Edge[],
          inputNodeId: "map-input-value",
          onLog: ctx.onLog,
          onPrompt: ctx.onPrompt,
          signal: ctx.signal,
        });

        return new EngineMapNode(
          async (item: unknown) => await runMapper(item),
        );
      }

      return new EngineMapNode((item: unknown) => item);
    }

    case NODE_TYPES.REDUCE_NODE: {
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (inputList: unknown[]) => {
            const connection = await ensureMicrobitConnected({ transport });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [inputList],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS],
          ["inputList", "output"],
          {
            stickyInputPorts: ["inputList"],
          },
        );
      }

      return new EngineReduceNode((acc, curr) => acc + curr, 0);
    }

    case NODE_TYPES.COUNT_NODE: {
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (inputList: unknown[]) => {
            const connection = await ensureMicrobitConnected({ transport });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [inputList],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS],
          ["inputList", "output"],
          {
            stickyInputPorts: ["inputList"],
          },
        );
      }

      return new EngineCountNode();
    }

    case NODE_TYPES.SCATTER_NODE: {
      const rawCount =
        typeof data.outputCount === "number" ? data.outputCount : 0;
      const inferredCount =
        ctx.scatterOutputCountByNodeId?.get(String(flowNode.id)) ?? 0;
      const outputCount = Math.max(rawCount, inferredCount, 0);
      return new EngineScatterNode({ outputCount });
    }

    case NODE_TYPES.GATHER_NODE: {
      const rawCount =
        typeof data.outputCount === "number" ? data.outputCount : 0;
      const inferredCount =
        ctx.gatherInputCountByNodeId?.get(String(flowNode.id)) ?? 0;
      const inputCount = Math.max(rawCount, inferredCount, 0);

      const incoming = ctx.gatherIncomingByNodeId?.get(String(flowNode.id));
      const firePatterns = Array.from({ length: inputCount }, (_v, idx) => {
        const portId = `input${idx + 1}`;
        return incoming?.has(portId)
          ? FirePatterns.EXISTS
          : FirePatterns.DONT_CARE;
      });

      return new EngineGatherNode({ inputCount, firePatterns });
    }

    case NODE_TYPES.SORT_LIST_NODE: {
      const order = data.order;
      const normalized = order === "desc" ? "desc" : "asc";

      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: { ...data, order: normalized },
          inputHandles: ["in"],
          outputPortId: "outputList",
        });

        return new NodeDefinition(
          async (inputList: unknown[]) => {
            const connection = await ensureMicrobitConnected({ transport });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [inputList],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS],
          ["inputList", "outputList"],
          {
            stickyInputPorts: ["inputList"],
          },
        );
      }

      return new EngineSortListNode(normalized);
    }

    default:
      return null;
  }
};
