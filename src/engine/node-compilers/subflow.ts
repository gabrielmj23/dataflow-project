import type { Edge, Node } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";

import { FirePatterns, NodeDefinition } from "../program-elements";
import { asRecord } from "../deserialize/utils";
import type { RemoteSubflowPayload } from "../deserialize/shared-types";

import type { NodeCompiler } from "./types";

export const compileSubflowNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);

  if (nodeType === NODE_TYPES.SUBFLOW_INPUT) {
    return new NodeDefinition(
      (v: unknown) => v,
      [FirePatterns.EXISTS],
      ["input", "output"],
    );
  }

  if (nodeType === NODE_TYPES.SUBFLOW_OUTPUT) {
    return new NodeDefinition(
      (v: unknown) => v,
      [FirePatterns.EXISTS],
      ["input", "output"],
    );
  }

  if (
    nodeType === NODE_TYPES.FILTER_INPUT_VALUE ||
    nodeType === NODE_TYPES.MAP_INPUT_VALUE
  ) {
    return new NodeDefinition(
      (v: unknown) => v,
      [FirePatterns.EXISTS],
      ["input", "output"],
    );
  }

  if (nodeType !== NODE_TYPES.SUBFLOW) return null;

  const templateIdRaw = data.templateId;
  const templateId =
    typeof templateIdRaw === "string" && templateIdRaw.trim().length > 0
      ? templateIdRaw.trim()
      : null;

  const selfTemplateId = templateId ?? String(flowNode.id);

  let subflowNodes = data.subflowNodes;
  let subflowEdges = data.subflowEdges;

  let inCount = typeof data.inCount === "number" ? data.inCount : undefined;
  let outCount = typeof data.outCount === "number" ? data.outCount : undefined;

  if (!Array.isArray(subflowNodes) || !Array.isArray(subflowEdges)) {
    const resolved =
      (templateId &&
        ctx.subflowRuntimeContext?.inlineTemplates?.get(templateId)) ||
      (templateId && ctx.resolveSubflowTemplate?.(templateId)) ||
      (templateId &&
        ctx.subflowRuntimeContext?.resolveTemplate?.(templateId)) ||
      null;

    if (resolved) {
      subflowNodes = resolved.nodes;
      subflowEdges = resolved.edges;
      inCount = typeof inCount === "number" ? inCount : resolved.inCount;
      outCount = typeof outCount === "number" ? outCount : resolved.outCount;
    }
  }

  if (Array.isArray(subflowNodes) && Array.isArray(subflowEdges)) {
    const inlineTemplates = ctx.subflowRuntimeContext?.inlineTemplates;
    if (inlineTemplates) {
      inlineTemplates.set(selfTemplateId, {
        id: selfTemplateId,
        name: typeof data.label === "string" ? data.label : undefined,
        inCount: typeof inCount === "number" ? inCount : 0,
        outCount: typeof outCount === "number" ? outCount : 0,
        nodes: subflowNodes as Node[],
        edges: subflowEdges as Edge[],
      });
    }

    const executionTarget = data.executionTarget;
    if (executionTarget === "controller") {
      const controllerId =
        typeof data.controllerId === "string" ? data.controllerId : "";
      const executor = ctx.remoteExecutor;

      const plan = ctx.helpers.computeSubflowExecutionPlan({
        subflowNodes: subflowNodes as Node[],
        subflowEdges: subflowEdges as Edge[],
        inCount,
        outCount,
        onLog: ctx.onLog,
        onPrompt: ctx.onPrompt,
        signal: ctx.signal,
        remoteExecutor: ctx.remoteExecutor,
        runtimeCtx: ctx.subflowRuntimeContext,
      });

      const firePatterns = plan.selectedInputs.map(() => FirePatterns.EXISTS);
      const inputPorts = plan.selectedInputs.map((_, idx) => `input${idx + 1}`);
      const outputPorts = plan.hasAnyOutput ? ["output1"] : [];

      return new NodeDefinition(
        async (...args: unknown[]) => {
          if (!executor) throw new Error("Ejecución remota no configurada.");
          if (!controllerId) throw new Error("No hay controller seleccionado.");

          return executor({
            nodeId: String(flowNode.id),
            controllerId,
            op: "subflow",
            args,
            subflow: {
              nodes: subflowNodes as Node[],
              edges: subflowEdges as Edge[],
              selectedInputs: plan.selectedInputs,
              outputSources: plan.outputSources,
              hasAnyOutput: plan.hasAnyOutput,
            } satisfies RemoteSubflowPayload,
          });
        },
        firePatterns,
        [...inputPorts, ...outputPorts],
      );
    }

    const currentTemplateId = ctx.subflowRuntimeContext?.currentTemplateId;
    if (currentTemplateId && currentTemplateId === selfTemplateId) {
      const safeIn =
        typeof inCount === "number" ? Math.max(0, Math.floor(inCount)) : 0;
      const safeOut =
        typeof outCount === "number" ? Math.max(0, Math.floor(outCount)) : 0;

      const firePatterns = Array.from(
        { length: safeIn },
        () => FirePatterns.EXISTS,
      );
      const inputPorts = Array.from(
        { length: safeIn },
        (_, i) => `input${i + 1}`,
      );
      const outputPorts = Array.from(
        { length: safeOut },
        (_, i) => `output${i + 1}`,
      );

      return new NodeDefinition(
        async (...args: unknown[]) => {
          const ctxNow = ctx.subflowRuntimeContext;
          const resolver =
            ctxNow?.inlineTemplates?.get(selfTemplateId) ??
            ctxNow?.resolveTemplate?.(selfTemplateId);

          if (!resolver) {
            throw new Error(
              `No se pudo resolver la plantilla recursiva '${selfTemplateId}'.`,
            );
          }

          const nestedDef = ctx.helpers.compileSubflowNodeDefinition({
            subflowNodes: resolver.nodes,
            subflowEdges: resolver.edges,
            inCount: resolver.inCount,
            outCount: resolver.outCount,
            onLog: ctx.onLog,
            onPrompt: ctx.onPrompt,
            signal: ctx.signal,
            runtimeCtx: ctxNow,
          });

          return await nestedDef.activationFunction(...args);
        },
        firePatterns,
        [...inputPorts, ...outputPorts],
      );
    }

    const prev = ctx.subflowRuntimeContext?.currentTemplateId;
    if (ctx.subflowRuntimeContext) {
      ctx.subflowRuntimeContext.currentTemplateId = selfTemplateId;
    }

    try {
      return ctx.helpers.compileSubflowNodeDefinition({
        subflowNodes: subflowNodes as Node[],
        subflowEdges: subflowEdges as Edge[],
        inCount,
        outCount,
        onLog: ctx.onLog,
        onPrompt: ctx.onPrompt,
        signal: ctx.signal,
        runtimeCtx: ctx.subflowRuntimeContext,
      });
    } finally {
      if (ctx.subflowRuntimeContext) {
        ctx.subflowRuntimeContext.currentTemplateId = prev;
      }
    }
  }

  const tmplRaw =
    (data && typeof data === "object"
      ? (data as { templateId?: unknown }).templateId
      : null) ?? null;
  const tmplId =
    typeof tmplRaw === "string" && tmplRaw.trim().length > 0
      ? tmplRaw.trim()
      : null;
  const inlineIds = ctx.subflowRuntimeContext?.inlineTemplates
    ? Array.from(ctx.subflowRuntimeContext.inlineTemplates.keys()).join(", ")
    : "(none)";
  const hasResolver = Boolean(
    ctx.subflowRuntimeContext?.resolveTemplate || ctx.resolveSubflowTemplate,
  );

  throw new Error(
    `Subflow node '${String(flowNode.id)}' is missing subflowNodes/subflowEdges and the template could not be resolved. templateId=${String(tmplId)}; inlineTemplates=[${inlineIds}]; resolverPresent=${hasResolver}`,
  );
};
