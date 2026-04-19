import { NODE_TYPES } from "@/common/constants";
import { ensureMicrobitConnected } from "@/microbit/connection-manager";
import { parseMicrobitSlot } from "@/microbit/slot-utils";
import { sendSubflowToMicrobit } from "@/microbit/subflow-sender";
import { validateFormula } from "@/utils/formula";
import { EngineFormulaNode } from "../nodes/algorithm-nodes";

import {
  EngineAndNode,
  EngineNandNode,
  EngineComparisonNode,
  EngineNotNode,
  EngineOrNode,
  EngineNorNode,
  EngineXorNode,
  EngineSwitchNode,
  EngineDesvioNode,
  EngineRelevoNode,
} from "../nodes/logic-nodes";
import type { SwitchCondition, SwitchOperator } from "../nodes/logic-nodes";
import {
  DataToken,
  FirePatterns,
  NodeDefinition,
  PortAddress,
} from "../program-elements";

import { asRecord, isNonEmptyArray } from "../deserialize/utils";
import type { NodeCompiler } from "./types";
import type { Edge, Node } from "@xyflow/react";

function parseTransport(data: Record<string, unknown>): "serial" | "bluetooth" {
  const transportRaw = (data.transport ?? data.connectionType) as unknown;
  return transportRaw === "bluetooth" || transportRaw === "serial"
    ? transportRaw
    : "serial";
}

function sanitizeProgramId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 32);
}

function buildMicrobitLogicGraph(params: {
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
  const inputNodes = params.inputHandles.map((_, index) => ({
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

function resolveComparisonOperator(
  nodeType: string,
  operator: unknown,
): "==" | "!=" | "<" | "<=" | ">" | ">=" {
  switch (nodeType) {
    case NODE_TYPES.COMPARISON_EQUAL_NODE:
      return "==";
    case NODE_TYPES.COMPARISON_NOT_EQUAL_NODE:
      return "!=";
    case NODE_TYPES.COMPARISON_LESS_NODE:
      return "<";
    case NODE_TYPES.COMPARISON_LESS_OR_EQUAL_NODE:
      return "<=";
    case NODE_TYPES.COMPARISON_GREATER_NODE:
      return ">";
    case NODE_TYPES.COMPARISON_GREATER_OR_EQUAL_NODE:
      return ">=";
    default:
      return operator === "==" ||
        operator === "!=" ||
        operator === "<" ||
        operator === "<=" ||
        operator === ">" ||
        operator === ">="
        ? operator
        : "==";
  }
}

export const compileLogicNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);
  const executionTarget = data.executionTarget;
  const microbitSlot = parseMicrobitSlot(data);

  switch (nodeType) {
    case NODE_TYPES.COMPARISON_NODE:
    case NODE_TYPES.COMPARISON_EQUAL_NODE:
    case NODE_TYPES.COMPARISON_NOT_EQUAL_NODE:
    case NODE_TYPES.COMPARISON_LESS_NODE:
    case NODE_TYPES.COMPARISON_LESS_OR_EQUAL_NODE:
    case NODE_TYPES.COMPARISON_GREATER_NODE:
    case NODE_TYPES.COMPARISON_GREATER_OR_EQUAL_NODE: {
      const op = resolveComparisonOperator(nodeType, data.operator);
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitLogicGraph({
          nodeId: String(flowNode.id),
          nodeType: NODE_TYPES.COMPARISON_NODE,
          nodeData: { ...data, operator: op },
          inputHandles: ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (input1: unknown, input2: unknown) => {
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [input1, input2],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2", "output"],
          {
            stickyInputPorts: ["input1", "input2"],
          },
        );
      }
      return new EngineComparisonNode(op);
    }
    case NODE_TYPES.AND_NODE:
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitLogicGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (input1: unknown, input2: unknown) => {
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [input1, input2],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2", "output"],
          {
            stickyInputPorts: ["input1", "input2"],
          },
        );
      }
      return new EngineAndNode();
    case NODE_TYPES.NAND_NODE:
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitLogicGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (input1: unknown, input2: unknown) => {
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [input1, input2],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2", "output"],
          {
            stickyInputPorts: ["input1", "input2"],
          },
        );
      }
      return new EngineNandNode();
    case NODE_TYPES.OR_NODE:
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitLogicGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (input1: unknown, input2: unknown) => {
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [input1, input2],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2", "output"],
          {
            stickyInputPorts: ["input1", "input2"],
          },
        );
      }
      return new EngineOrNode();
    case NODE_TYPES.NOR_NODE:
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitLogicGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (input1: unknown, input2: unknown) => {
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [input1, input2],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2", "output"],
          {
            stickyInputPorts: ["input1", "input2"],
          },
        );
      }
      return new EngineNorNode();
    case NODE_TYPES.XOR_NODE:
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitLogicGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (input1: unknown, input2: unknown) => {
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [input1, input2],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["input1", "input2", "output"],
          {
            stickyInputPorts: ["input1", "input2"],
          },
        );
      }
      return new EngineXorNode();
    case NODE_TYPES.NOT_NODE:
      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitLogicGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (input: unknown) => {
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            return await sendSubflowToMicrobit({
              connection,
              nodes: graph.nodes,
              edges: graph.edges,
              selectedInputs: graph.selectedInputs,
              outputSources: graph.outputSources,
              args: [input],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS],
          ["input", "output"],
          {
            stickyInputPorts: ["input"],
          },
        );
      }
      return new EngineNotNode();

    case NODE_TYPES.LOGIC_OPERATION_NODE: {
      const operation = data.operation as string;
      const opNodeType =
        operation === NODE_TYPES.AND_NODE
          ? NODE_TYPES.AND_NODE
          : operation === NODE_TYPES.NAND_NODE
            ? NODE_TYPES.NAND_NODE
            : operation === NODE_TYPES.OR_NODE
              ? NODE_TYPES.OR_NODE
              : operation === NODE_TYPES.NOR_NODE
                ? NODE_TYPES.NOR_NODE
                : operation === NODE_TYPES.XOR_NODE
                  ? NODE_TYPES.XOR_NODE
                  : operation === NODE_TYPES.NOT_NODE
                    ? NODE_TYPES.NOT_NODE
                    : NODE_TYPES.AND_NODE;

      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const isUnary = opNodeType === NODE_TYPES.NOT_NODE;
        const graph = buildMicrobitLogicGraph({
          nodeId: String(flowNode.id),
          nodeType: opNodeType,
          nodeData: data,
          inputHandles: isUnary ? ["in"] : ["in-1", "in-2"],
          outputPortId: "output",
        });

        return new NodeDefinition(
          async (...args: unknown[]) => {
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
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
          isUnary
            ? [FirePatterns.EXISTS]
            : [FirePatterns.EXISTS, FirePatterns.EXISTS],
          isUnary ? ["input", "output"] : ["input1", "input2", "output"],
          {
            stickyInputPorts: isUnary ? ["input"] : ["input1", "input2"],
          },
        );
      }

      switch (opNodeType) {
        case NODE_TYPES.AND_NODE:
          return new EngineAndNode();
        case NODE_TYPES.NAND_NODE:
          return new EngineNandNode();
        case NODE_TYPES.OR_NODE:
          return new EngineOrNode();
        case NODE_TYPES.NOR_NODE:
          return new EngineNorNode();
        case NODE_TYPES.XOR_NODE:
          return new EngineXorNode();
        case NODE_TYPES.NOT_NODE:
          return new EngineNotNode();
        default:
          return new EngineAndNode();
      }
    }

    case NODE_TYPES.DESVIO_NODE:
      return new EngineDesvioNode();

    case NODE_TYPES.RELEVO_NODE:
      return new EngineRelevoNode();

    case NODE_TYPES.LOGIC_FORMULA_NODE: {
      const formula = data.formula;
      const variables = data.variables;
      return new EngineFormulaNode({
        formula,
        variables,
        mode: "logic",
      });
    }

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

    case NODE_TYPES.CONDITIONAL_NODE: {
      const inputsRaw = isNonEmptyArray(data.inputs)
        ? data.inputs
        : [{ label: "a" }];
      const inputs = inputsRaw.map((it, idx) => {
        const labelRaw =
          it && typeof it === "object"
            ? (it as { label?: unknown }).label
            : null;
        const label =
          typeof labelRaw === "string" && labelRaw.trim().length > 0
            ? labelRaw.trim()
            : String.fromCharCode(97 + idx);
        return { label, portId: `input${idx + 1}` };
      });

      const conditionsRaw = isNonEmptyArray(data.conditions)
        ? data.conditions
        : [{ outputToken: "Salida 1", formula: inputs[0]?.label ?? "a" }];
      const conditions = conditionsRaw.map((cond, idx) => {
        const outputTokenRaw =
          cond && typeof cond === "object"
            ? (cond as { outputToken?: unknown }).outputToken
            : null;
        const formulaRaw =
          cond && typeof cond === "object"
            ? (cond as { formula?: unknown }).formula
            : null;

        const outputToken =
          typeof outputTokenRaw === "string" && outputTokenRaw.trim().length > 0
            ? outputTokenRaw.trim()
            : `Salida ${idx + 1}`;

        const formula = typeof formulaRaw === "string" ? formulaRaw.trim() : "";
        const validation = validateFormula(formula === "" ? "0" : formula, {
          mode: "logic",
        });

        return {
          outputToken,
          compiled: validation.ok ? (validation.compiled ?? null) : null,
        };
      });

      const inputPorts = inputs.map((i) => i.portId);
      const ports = [...inputPorts, "output"];

      const incoming = ctx.conditionalIncomingByNodeId?.get(
        String(flowNode.id),
      );
      const firePatterns = inputPorts.map((portId) =>
        incoming?.has(portId) ? FirePatterns.EXISTS : FirePatterns.DONT_CARE,
      );

      return new NodeDefinition(
        (...args: unknown[]) => {
          const scope: Record<string, number> = {};
          for (let i = 0; i < inputs.length; i += 1) {
            const name = inputs[i]?.label ?? `var${i + 1}`;
            const value = args[i];
            const num = Number(value);
            scope[name] = Number.isFinite(num) ? num : 0;
          }

          for (const cond of conditions) {
            if (!cond.compiled) continue;
            const result = cond.compiled.evaluate(scope);
            const truthy =
              typeof result === "boolean" ? result : Number(result) !== 0;
            if (truthy) {
              return [
                new DataToken(cond.outputToken, new PortAddress("", "output")),
              ];
            }
          }

          return [new DataToken(undefined, new PortAddress("", "output"))];
        },
        firePatterns,
        ports,
      );
    }

    case NODE_TYPES.SELECTOR_NODE: {
      const incoming = ctx.selectorIncomingByNodeId?.get(String(flowNode.id));
      const firePatterns = [
        FirePatterns.EXISTS,
        incoming?.has("trueValue")
          ? FirePatterns.EXISTS
          : FirePatterns.DONT_CARE,
        incoming?.has("falseValue")
          ? FirePatterns.EXISTS
          : FirePatterns.DONT_CARE,
      ];

      return new NodeDefinition(
        (condition: unknown, trueValue: unknown, falseValue: unknown) => {
          const selected = condition ? trueValue : falseValue;
          return [new DataToken(selected, new PortAddress("", "output"))];
        },
        firePatterns,
        ["condition", "trueValue", "falseValue", "output"],
      );
    }

    case NODE_TYPES.CONDITIONAL_SELECTOR_NODE: {
      const optionsRaw = Array.isArray(data.options) ? data.options : [];
      const options =
        optionsRaw.length > 0
          ? optionsRaw
          : [
              { token: "Salida 1", value: 0 },
              { token: "Salida 2", value: 0 },
            ];

      const tokens = options.map((opt, idx) => {
        const tokenRaw =
          opt && typeof opt === "object"
            ? (opt as { token?: unknown }).token
            : null;
        return typeof tokenRaw === "string" && tokenRaw.trim().length > 0
          ? tokenRaw.trim()
          : `Salida ${idx + 1}`;
      });

      const inputPorts = tokens.map((_, idx) => `input${idx + 1}`);
      const outputPorts = tokens.map((_, idx) => `output${idx + 1}`);

      const ports = ["token", ...inputPorts, ...outputPorts, "output"];

      const incoming = ctx.selectorIncomingByNodeId?.get(String(flowNode.id));
      const firePatterns = [
        FirePatterns.EXISTS,
        ...inputPorts.map((portId, idx) => {
          const legacyTokenPort = tokens[idx];
          return incoming?.has(portId) || incoming?.has(legacyTokenPort)
            ? FirePatterns.EXISTS
            : FirePatterns.DONT_CARE;
        }),
      ];

      return new NodeDefinition(
        (token: unknown, ...args: unknown[]) => {
          const values = args.slice(0, inputPorts.length);
          const tokenStr = String(token ?? "");
          const matchIdx = tokens.findIndex((t) => t === tokenStr);
          const selected = matchIdx >= 0 ? values[matchIdx] : undefined;

          if (matchIdx >= 0) {
            const outputPortId = outputPorts[matchIdx] ?? "output";
            const legacyPortId = tokens[matchIdx] ?? outputPortId;

            // Emit both stable and legacy port ids so old projects keep
            // running even if edges still use token-named source handles.
            return [
              new DataToken(selected, new PortAddress("", outputPortId)),
              new DataToken(selected, new PortAddress("", legacyPortId)),
            ];
          }

          return [new DataToken(selected, new PortAddress("", "output"))];
        },
        firePatterns,
        ports,
      );
    }

    default:
      return null;
  }
};
