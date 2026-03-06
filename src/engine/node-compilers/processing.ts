import type { Edge, Node } from "@xyflow/react";
import { NODE_TYPES } from "@/common/constants";
import { ensureMicrobitConnected } from "@/microbit/connection-manager";
import { sendSubflowToMicrobit } from "@/microbit/subflow-sender";

import {
  EngineCeilingNode,
  EngineConcatNode,
  EngineDivideNode,
  EngineFloorNode,
  EngineFormulaNode,
  EngineLogarithmNode,
  EngineModNode,
  EngineMultiplyNode,
  EnginePowerNode,
  EngineRootNode,
  EngineReplaceTextNode,
  EngineRoundNode,
  EngineSliceTextNode,
  EngineSubtractTextNode,
  EngineSubstractNode,
  EngineSumNode,
} from "../nodes/algorithm-nodes";
import { FirePatterns, NodeDefinition } from "../program-elements";

import { asRecord } from "../deserialize/utils";
import type { RemoteExecutionOp } from "../deserialize/shared-types";
import type { NodeCompiler } from "./types";

function parseTransport(data: Record<string, unknown>): "serial" | "bluetooth" {
  const transportRaw = (data.transport ?? data.connectionType) as unknown;
  return transportRaw === "bluetooth" || transportRaw === "serial"
    ? transportRaw
    : "serial";
}

function createRemoteExecutionNode(params: {
  nodeId: string;
  controllerId: string;
  executor: (req: {
    nodeId: string;
    controllerId: string;
    op: RemoteExecutionOp;
    args: unknown[];
  }) => Promise<unknown>;
  op: RemoteExecutionOp;
  ports: string[];
  firePatterns: FirePatterns[];
  stickyInputPorts?: string[];
}): NodeDefinition {
  return new NodeDefinition(
    async (...args: unknown[]) => {
      return params.executor({
        nodeId: params.nodeId,
        controllerId: params.controllerId,
        op: params.op,
        args,
      });
    },
    params.firePatterns,
    params.ports,
    params.stickyInputPorts
      ? { stickyInputPorts: params.stickyInputPorts }
      : undefined,
  );
}

function buildMicrobitRemoteGraph(params: {
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
  const inputNodes = params.inputHandles.map((_entry, index) => ({
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

  return {
    nodes: [...inputNodes, opNode],
    edges,
    selectedInputs,
    outputSources: [{ nodeId: opNodeId, portId: params.outputPortId }],
    programId: `${params.nodeId}-${params.outputPortId}`
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 32),
  };
}

export const compileProcessingNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);

  const executionTarget = data.executionTarget;
  const controllerId =
    typeof data.controllerId === "string" ? data.controllerId : "";

  const ensureRemote = (
    op: RemoteExecutionOp,
    ports: string[],
    firePatterns: FirePatterns[],
    stickyInputPorts?: string[],
  ) => {
    const executor = ctx.remoteExecutor;
    if (!executor) throw new Error("Ejecución remota no configurada.");
    if (!controllerId) throw new Error("No hay controller seleccionado.");

    return createRemoteExecutionNode({
      nodeId: String(flowNode.id),
      controllerId,
      executor,
      op,
      ports,
      firePatterns,
      stickyInputPorts,
    });
  };

  const ensureMicrobitSubflow = (params: {
    inputHandles: string[];
    ports: string[];
    firePatterns: FirePatterns[];
    stickyInputPorts?: string[];
    outputPortId?: string;
  }) => {
    const transport = parseTransport(data);
    const graph = buildMicrobitRemoteGraph({
      nodeId: String(flowNode.id),
      nodeType,
      nodeData: data,
      inputHandles: params.inputHandles,
      outputPortId: params.outputPortId ?? "output",
    });

    return new NodeDefinition(
      async (...args: unknown[]) => {
        const connection = await ensureMicrobitConnected({ transport });
        return await sendSubflowToMicrobit({
          connection,
          nodes: graph.nodes,
          edges: graph.edges,
          selectedInputs: graph.selectedInputs,
          outputSources: graph.outputSources,
          args,
          programId: graph.programId,
          signal: ctx.signal,
        });
      },
      params.firePatterns,
      params.ports,
      params.stickyInputPorts
        ? { stickyInputPorts: params.stickyInputPorts }
        : undefined,
    );
  };

  switch (nodeType) {
    case NODE_TYPES.SUM_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "sum",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EngineSumNode();
    }
    case NODE_TYPES.SUBTRACT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "subtract",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EngineSubstractNode();
    }
    case NODE_TYPES.MULTIPLY_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "multiply",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EngineMultiplyNode();
    }
    case NODE_TYPES.DIVIDE_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "divide",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EngineDivideNode();
    }
    case NODE_TYPES.MOD_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "mod",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EngineModNode();
    }
    case NODE_TYPES.POWER_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "power",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EnginePowerNode();
    }
    case NODE_TYPES.ROOT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "root",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EngineRootNode();
    }
    case NODE_TYPES.LOGARITHM_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "logarithm",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EngineLogarithmNode();
    }
    case NODE_TYPES.FLOOR_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "floor",
          ["input1", "output"],
          [FirePatterns.EXISTS],
          ["input1"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1"],
          ports: ["input1", "output"],
          firePatterns: [FirePatterns.EXISTS],
          stickyInputPorts: ["input1"],
        });
      }
      return new EngineFloorNode();
    }
    case NODE_TYPES.CEILING_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "ceiling",
          ["input1", "output"],
          [FirePatterns.EXISTS],
          ["input1"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1"],
          ports: ["input1", "output"],
          firePatterns: [FirePatterns.EXISTS],
          stickyInputPorts: ["input1"],
        });
      }
      return new EngineCeilingNode();
    }
    case NODE_TYPES.ROUND_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "round",
          ["input1", "output"],
          [FirePatterns.EXISTS],
          ["input1"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1"],
          ports: ["input1", "output"],
          firePatterns: [FirePatterns.EXISTS],
          stickyInputPorts: ["input1"],
        });
      }
      return new EngineRoundNode();
    }
    case NODE_TYPES.CONCAT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "concat",
          ["input1", "input2", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2"],
        );
      }
      if (executionTarget === "microbit") {
        return ensureMicrobitSubflow({
          inputHandles: ["in-1", "in-2"],
          ports: ["input1", "input2", "output"],
          firePatterns: [FirePatterns.EXISTS, FirePatterns.EXISTS],
          stickyInputPorts: ["input1", "input2"],
        });
      }
      return new EngineConcatNode();
    }
    case NODE_TYPES.REPLACE_TEXT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "replaceText",
          ["text", "search", "replacement", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["text", "search", "replacement"],
        );
      }
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitRemoteGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2", "in-3"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (text: unknown, search: unknown, replacement: unknown) => {
            const connection = await ensureMicrobitConnected({ transport });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [text, search, replacement],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["text", "search", "replacement", "output"],
          { stickyInputPorts: ["text", "search", "replacement"] },
        );
      }
      return new EngineReplaceTextNode();
    }
    case NODE_TYPES.SUBTRACT_TEXT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "subtractText",
          ["text", "search", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["text", "search"],
        );
      }
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitRemoteGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (text: unknown, search: unknown) => {
            const connection = await ensureMicrobitConnected({ transport });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [text, search],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["text", "search", "output"],
          { stickyInputPorts: ["text", "search"] },
        );
      }
      return new EngineSubtractTextNode();
    }
    case NODE_TYPES.SLICE_TEXT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "sliceText",
          ["text", "start", "end", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["text", "start", "end"],
        );
      }
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitRemoteGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2", "in-3"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (text: unknown, start: unknown, end: unknown) => {
            const connection = await ensureMicrobitConnected({ transport });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [text, start, end],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["text", "start", "end", "output"],
          { stickyInputPorts: ["text", "start", "end"] },
        );
      }
      return new EngineSliceTextNode();
    }
    case NODE_TYPES.FORMULA_EDITOR_NODE: {
      const formula = data.formula;
      const variables = data.variables;
      return new EngineFormulaNode({ formula, variables });
    }
    default:
      return null;
  }
};
