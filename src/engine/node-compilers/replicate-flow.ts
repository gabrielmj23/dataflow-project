import type { Edge, Node } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";

import { FirePatterns, NodeDefinition } from "../program-elements";
import { asRecord } from "../deserialize/utils";
import type { RemoteSubflowPayload } from "../deserialize/shared-types";
import { microbitSlotManager } from "@/microbit/slot-manager";
import { sendSubflowToMicrobit } from "@/microbit/subflow-sender";

import type { NodeCompiler } from "./types";

function isSubflowLikeType(type: string): boolean {
  return type === NODE_TYPES.SUBFLOW || type === NODE_TYPES.REPLICATE_FLOW;
}

type SubflowExecutionConfig = {
  executionTarget: "local" | "controller" | "microbit";
  transport: "serial" | "bluetooth";
  controllerId: string;
  slot: number;
};

function sanitizeSlot(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(8, Math.floor(n)));
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fallback below
    }
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function cloneArgsForReplica(args: unknown[]): unknown[] {
  return args.map((arg) => cloneValue(arg));
}

function resolveExecutionConfigs(
  data: Record<string, unknown>,
): SubflowExecutionConfig[] {
  const connectionsRaw = data.remoteConnections;
  const connections = Array.isArray(connectionsRaw)
    ? connectionsRaw
        .map((entry, index): SubflowExecutionConfig | null => {
          if (!entry || typeof entry !== "object") return null;
          const value = asRecord(entry);
          const executionTarget =
            value.executionTarget === "controller" ||
            value.executionTarget === "microbit"
              ? value.executionTarget
              : "local";
          const transport =
            value.transport === "bluetooth" ? "bluetooth" : "serial";
          const controllerId =
            typeof value.controllerId === "string" ? value.controllerId : "";
          const slot = sanitizeSlot(value.microbitSlot ?? index + 1);
          return {
            executionTarget,
            transport,
            controllerId,
            slot,
          };
        })
        .filter((value): value is SubflowExecutionConfig => Boolean(value))
    : [];

  if (connections.length > 0) {
    return connections;
  }

  return [
    {
      executionTarget: "local",
      transport: "serial",
      controllerId: "",
      slot: 1,
    },
  ];
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

export const compileReplicateFlowNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);

  if (nodeType !== NODE_TYPES.REPLICATE_FLOW) return null;

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

    const executionConfigs = resolveExecutionConfigs(data);

    const localPlan = ctx.helpers.computeSubflowExecutionPlan({
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

    const requiresReplicaInput = localPlan.selectedInputs.length > 0;

    const replicaCount = Math.max(1, executionConfigs.length);
    const firePatterns = requiresReplicaInput
      ? Array.from({ length: replicaCount }, () => FirePatterns.EXISTS)
      : [];
    const inputPorts = requiresReplicaInput
      ? Array.from({ length: replicaCount }, (_, idx) => `input${idx + 1}`)
      : [];
    const outputPorts = Array.from(
      { length: replicaCount },
      (_, idx) => `output${idx + 1}`,
    );

    const hasControllerTarget = executionConfigs.some(
      (entry) => entry.executionTarget === "controller",
    );

    const materializedForController = hasControllerTarget
      ? materializeSubflowGraphForRemote(
          subflowNodes as Node[],
          subflowEdges as Edge[],
          ctx,
          new Set<string>(),
        )
      : null;

    const controllerPlan = materializedForController
      ? ctx.helpers.computeSubflowExecutionPlan({
          subflowNodes: materializedForController.nodes,
          subflowEdges: materializedForController.edges,
          inCount,
          outCount,
          onLog: ctx.onLog,
          onPrompt: ctx.onPrompt,
          signal: ctx.signal,
          remoteExecutor: ctx.remoteExecutor,
          runtimeCtx: ctx.subflowRuntimeContext,
        })
      : null;

    const rawId = templateId ?? String(flowNode.id);
    const programId = rawId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 32);

    const currentTemplateId = ctx.subflowRuntimeContext?.currentTemplateId;
    const isRecursiveTemplate =
      Boolean(currentTemplateId) && currentTemplateId === selfTemplateId;

    const localDefinition = (() => {
      if (isRecursiveTemplate) {
        return null;
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
    })();

    const executeLocal = async (...args: unknown[]) => {
      if (isRecursiveTemplate) {
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
      }

      if (!localDefinition) {
        throw new Error("No se pudo compilar la ejecución local del subflujo.");
      }

      return await localDefinition.activationFunction(...args);
    };

    return new NodeDefinition(
      async (...args: unknown[]) => {
        const replicaResults: unknown[] = [];
        const executor = ctx.remoteExecutor;

        for (let index = 0; index < executionConfigs.length; index += 1) {
          const config = executionConfigs[index];
          const replicaArgs = requiresReplicaInput
            ? cloneArgsForReplica([args[index]])
            : [];

          if (config.executionTarget === "controller") {
            if (!executor) throw new Error("Ejecución remota no configurada.");
            if (!config.controllerId) {
              throw new Error("No hay controller seleccionado.");
            }
            if (!materializedForController || !controllerPlan) {
              throw new Error(
                "No se pudo materializar el subflujo para ejecución remota.",
              );
            }

            const lastResult = await executor({
              nodeId: String(flowNode.id),
              controllerId: config.controllerId,
              op: "subflow",
              args: replicaArgs,
              subflow: {
                nodes: materializedForController.nodes,
                edges: materializedForController.edges,
                selectedInputs: controllerPlan.selectedInputs,
                outputSources: controllerPlan.outputSources,
                hasAnyOutput: controllerPlan.hasAnyOutput,
              } satisfies RemoteSubflowPayload,
            });
            replicaResults.push(lastResult);
            continue;
          }

          if (config.executionTarget === "microbit") {
            const connection = microbitSlotManager.getConnection(config.slot);
            if (!connection) {
              throw new Error(
                `La micro:bit del slot ${config.slot} no está conectada. Abre el diálogo "Conectar" del header y conéctala antes de ejecutar.`,
              );
            }

            const lastResult = await sendSubflowToMicrobit({
              connection,
              nodes: subflowNodes as Node[],
              edges: subflowEdges as Edge[],
              selectedInputs: localPlan.selectedInputs,
              outputSources: localPlan.outputSources,
              args: replicaArgs,
              programId,
              signal: ctx.signal,
            });
            replicaResults.push(lastResult);
            continue;
          }

          const lastResult = await executeLocal(...replicaArgs);
          replicaResults.push(lastResult);
        }

        while (replicaResults.length < outputPorts.length) {
          replicaResults.push(undefined);
        }

        return replicaResults;
      },
      firePatterns,
      [...inputPorts, ...outputPorts],
      { skipStepDelay: true },
    );
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
    `Replicate flow node '${String(flowNode.id)}' is missing subflowNodes/subflowEdges and the template could not be resolved. templateId=${String(tmplId)}; inlineTemplates=[${inlineIds}]; resolverPresent=${hasResolver}`,
  );
};
