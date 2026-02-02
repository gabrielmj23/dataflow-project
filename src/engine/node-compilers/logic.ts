import { NODE_TYPES } from "@/common/constants";
import { validateFormula } from "@/utils/formula";

import {
  EngineAndNode,
  EngineNandNode,
  EngineComparisonNode,
  EngineNotNode,
  EngineOrNode,
  EngineNorNode,
  EngineXorNode,
  EngineSwitchNode,
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

export const compileLogicNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);

  switch (nodeType) {
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
        const validation = validateFormula(formula === "" ? "0" : formula);

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

      const ports = ["token", ...tokens, "output"];

      const incoming = ctx.selectorIncomingByNodeId?.get(String(flowNode.id));
      const firePatterns = [
        FirePatterns.EXISTS,
        ...tokens.map((t) =>
          incoming?.has(t) ? FirePatterns.EXISTS : FirePatterns.DONT_CARE,
        ),
      ];

      return new NodeDefinition(
        (token: unknown, ...values: unknown[]) => {
          const tokenStr = String(token ?? "");
          const matchIdx = tokens.findIndex((t) => t === tokenStr);
          const selected = matchIdx >= 0 ? values[matchIdx] : undefined;

          const targetPort = matchIdx >= 0 ? tokenStr : "output";

          return [new DataToken(selected, new PortAddress("", targetPort))];
        },
        firePatterns,
        ports,
      );
    }

    default:
      return null;
  }
};
