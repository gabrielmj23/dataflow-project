import type { Edge, Node } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";

import { FirePatterns, NodeDefinition } from "../program-elements";
import { asRecord } from "../deserialize/utils";
import type { RemoteSubflowPayload } from "../deserialize/shared-types";
import { ensureMicrobitConnected } from "@/microbit/connection-manager";
import { parseMicrobitSlot } from "@/microbit/slot-utils";
import { sendSubflowToMicrobit } from "@/microbit/subflow-sender";

import type { NodeCompiler } from "./types";

function isSubflowLikeType(type: string): boolean {
  return type === NODE_TYPES.SUBFLOW;
}

function resolveTemplateForRemote(
  templateId: string,
  ctx: Parameters<NodeCompiler>[1],
): {
  nodes: Node[];
  edges: Edge[];
  inCount: number;
  outCount: number;
  name?: string;
} | null {
  const runtime = ctx.subflowRuntimeContext;
  const inline = runtime?.inlineTemplates?.get(templateId) ?? null;
  if (inline) {
    return {
      nodes: inline.nodes,
      edges: inline.edges,
      inCount: inline.inCount,
      outCount: inline.outCount,
      name: inline.name,
    };
  }

  const resolved =
    ctx.resolveSubflowTemplate?.(templateId) ??
    runtime?.resolveTemplate?.(templateId) ??
    null;
  if (!resolved) return null;

  return {
    nodes: resolved.nodes,
    edges: resolved.edges,
    inCount: resolved.inCount,
    outCount: resolved.outCount,
    name: resolved.name,
  };
}

function materializeSubflowGraphForRemote(
  nodes: Node[],
  edges: Edge[],
  ctx: Parameters<NodeCompiler>[1],
  visited: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const materializedNodes = nodes.map((n) => {
    if (!isSubflowLikeType(String(n.type))) return n;

    const data = asRecord(n.data);
    const hasEmbedded =
      Array.isArray(data.subflowNodes) && Array.isArray(data.subflowEdges);
    if (hasEmbedded) {
      // Still recursively materialize any nested subflows within the embedded graph.
      const childNodes = data.subflowNodes as Node[];
      const childEdges = data.subflowEdges as Edge[];
      const childTemplateIdRaw = data.templateId;
      const childTemplateId =
        typeof childTemplateIdRaw === "string" &&
        childTemplateIdRaw.trim().length > 0
          ? childTemplateIdRaw.trim()
          : String(n.id);

      if (visited.has(childTemplateId)) return n;
      visited.add(childTemplateId);
      const inner = materializeSubflowGraphForRemote(
        childNodes,
        childEdges,
        ctx,
        visited,
      );
      visited.delete(childTemplateId);

      // Only write back if something actually changed.
      if (inner.nodes === childNodes && inner.edges === childEdges) return n;
      return {
        ...n,
        data: {
          ...(data as object),
          subflowNodes: inner.nodes,
          subflowEdges: inner.edges,
        },
      } as Node;
    }

    const templateIdRaw = data.templateId;
    const templateId =
      typeof templateIdRaw === "string" && templateIdRaw.trim().length > 0
        ? templateIdRaw.trim()
        : null;
    if (!templateId) return n;
    if (visited.has(templateId)) return n;

    const resolved = resolveTemplateForRemote(templateId, ctx);
    if (!resolved) return n;

    visited.add(templateId);
    const inner = materializeSubflowGraphForRemote(
      resolved.nodes,
      resolved.edges,
      ctx,
      visited,
    );
    visited.delete(templateId);

    return {
      ...n,
      data: {
        ...(data as object),
        label: typeof data.label === "string" ? data.label : resolved.name,
        inCount:
          typeof data.inCount === "number" ? data.inCount : resolved.inCount,
        outCount:
          typeof data.outCount === "number" ? data.outCount : resolved.outCount,
        subflowNodes: inner.nodes,
        subflowEdges: inner.edges,
      },
    } as Node;
  });

  // `edges` are unchanged; we return the same reference when nodes are unchanged.
  const anyChanged = materializedNodes.some((n, i) => n !== nodes[i]);
  return { nodes: anyChanged ? materializedNodes : nodes, edges };
}

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

  if (
    nodeType === NODE_TYPES.SUBFLOW_OUTPUT ||
    nodeType === NODE_TYPES.FILTER_BOOLEAN_OUTPUT
  ) {
    return new NodeDefinition(
      (v: unknown) => v,
      [FirePatterns.EXISTS],
      ["input", "output"],
    );
  }

  if (
    nodeType === NODE_TYPES.FILTER_INPUT_VALUE ||
    nodeType === NODE_TYPES.MAP_INPUT_VALUE ||
    nodeType === NODE_TYPES.REPLICATE_INPUT_VALUE
  ) {
    return new NodeDefinition(
      (v: unknown) => v,
      [FirePatterns.EXISTS],
      ["input", "output"],
    );
  }

  if (!isSubflowLikeType(nodeType)) return null;

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

      // Controllers do not have access to the runner's template registry/resolvers.
      // Inline any referenced subflow templates so the controller can compile the graph.
      const materialized = materializeSubflowGraphForRemote(
        subflowNodes as Node[],
        subflowEdges as Edge[],
        ctx,
        new Set<string>(),
      );

      const plan = ctx.helpers.computeSubflowExecutionPlan({
        subflowNodes: materialized.nodes,
        subflowEdges: materialized.edges,
        inCount,
        outCount,
        onLog: ctx.onLog,
        onPrompt: ctx.onPrompt,
        onEdgeValue: ctx.onEdgeValue,
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
              nodes: materialized.nodes,
              edges: materialized.edges,
              selectedInputs: plan.selectedInputs,
              outputSources: plan.outputSources,
              hasAnyOutput: plan.hasAnyOutput,
            } satisfies RemoteSubflowPayload,
          });
        },
        firePatterns,
        [...inputPorts, ...outputPorts],
        { skipStepDelay: true },
      );
    }

    if (executionTarget === "microbit") {
      const transport = data.transport === "bluetooth" ? "bluetooth" : "serial";
      const microbitSlot = parseMicrobitSlot(data);

      const plan = ctx.helpers.computeSubflowExecutionPlan({
        subflowNodes: subflowNodes as Node[],
        subflowEdges: subflowEdges as Edge[],
        inCount,
        outCount,
        onLog: ctx.onLog,
        onPrompt: ctx.onPrompt,
        onEdgeValue: ctx.onEdgeValue,
        signal: ctx.signal,
        remoteExecutor: ctx.remoteExecutor,
        runtimeCtx: ctx.subflowRuntimeContext,
      });

      const firePatterns = plan.selectedInputs.map(() => FirePatterns.EXISTS);
      const inputPorts = plan.selectedInputs.map((_, idx) => `input${idx + 1}`);
      const outputPorts = plan.hasAnyOutput ? ["output1"] : [];

      const rawId = templateId ?? String(flowNode.id);
      const programId = rawId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 32);

      return new NodeDefinition(
        async (...args: unknown[]) => {
          const connection = await ensureMicrobitConnected({
            transport,
            slot: microbitSlot,
          });

          return await sendSubflowToMicrobit({
            connection,
            nodes: subflowNodes as Node[],
            edges: subflowEdges as Edge[],
            selectedInputs: plan.selectedInputs,
            outputSources: plan.outputSources,
            args,
            programId,
            signal: ctx.signal,
          });
        },
        firePatterns,
        [...inputPorts, ...outputPorts],
        { skipStepDelay: true },
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
            onEdgeValue: ctx.onEdgeValue,
            signal: ctx.signal,
            runtimeCtx: ctxNow,
          });

          return await nestedDef.activationFunction(...args);
        },
        firePatterns,
        [...inputPorts, ...outputPorts],
        { skipStepDelay: true },
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
        onEdgeValue: ctx.onEdgeValue,
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
