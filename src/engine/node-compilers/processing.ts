import { NODE_TYPES } from "@/common/constants";

import {
  EngineCeilingNode,
  EngineConcatNode,
  EngineDivideNode,
  EngineFloorNode,
  EngineFormulaNode,
  EngineModNode,
  EngineMultiplyNode,
  EnginePowerNode,
  EngineRoundNode,
  EngineSubstractNode,
  EngineSumNode,
} from "../nodes/algorithm-nodes";
import {
  EngineMicrobitCeilingNode,
  EngineMicrobitConcatNode,
  EngineMicrobitDivideNode,
  EngineMicrobitFloorNode,
  EngineMicrobitModNode,
  EngineMicrobitMultiplyNode,
  EngineMicrobitPowerNode,
  EngineMicrobitRoundNode,
  EngineMicrobitSubtractNode,
  EngineMicrobitSumNode,
} from "../nodes/microbit-nodes";
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
        const transport = parseTransport(data);
        return new EngineMicrobitSumNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
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
        const transport = parseTransport(data);
        return new EngineMicrobitSubtractNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
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
        const transport = parseTransport(data);
        return new EngineMicrobitMultiplyNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
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
        const transport = parseTransport(data);
        return new EngineMicrobitDivideNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
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
        const transport = parseTransport(data);
        return new EngineMicrobitModNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
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
        const transport = parseTransport(data);
        return new EngineMicrobitPowerNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
        });
      }
      return new EnginePowerNode();
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
        const transport = parseTransport(data);
        return new EngineMicrobitFloorNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
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
        const transport = parseTransport(data);
        return new EngineMicrobitCeilingNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
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
        const transport = parseTransport(data);
        return new EngineMicrobitRoundNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
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
        const transport = parseTransport(data);
        return new EngineMicrobitConcatNode({
          nodeId: String(flowNode.id),
          transport,
          onLog: ctx.onLog,
          signal: ctx.signal,
        });
      }
      return new EngineConcatNode();
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
