import type { Edge, Node } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";

import {
  EngineCountNode,
  EngineFilterNode,
  EngineGenerateSequenceNode,
  EngineMapNode,
  EnginePulseSequenceNode,
  EngineReduceNode,
  EngineZipNode,
  EngineUnzipNode,
} from "../nodes/list-nodes";
import { FirePatterns } from "../program-elements";

import { asRecord, isNonEmptyArray } from "../deserialize/utils";
import type { NodeCompiler } from "./types";

export const compileListNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);

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

    case NODE_TYPES.ZIP_NODE:
      return new EngineZipNode();

    case NODE_TYPES.UNZIP_NODE:
      return new EngineUnzipNode();

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

    case NODE_TYPES.REDUCE_NODE:
      return new EngineReduceNode((acc, curr) => acc + curr, 0);

    case NODE_TYPES.COUNT_NODE:
      return new EngineCountNode();

    default:
      return null;
  }
};
