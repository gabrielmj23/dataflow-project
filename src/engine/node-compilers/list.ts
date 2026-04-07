import type { Edge, Node } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";
import { ensureMicrobitConnected } from "@/microbit/connection-manager";
import { parseMicrobitSlot } from "@/microbit/slot-utils";
import { sendSubflowToMicrobit } from "@/microbit/subflow-sender";

import {
  EngineCountNode,
  EngineGenerateSequenceNode,
  EngineListAppendNode,
  EngineListAtPositionNode,
  EngineListEvenPositionsNode,
  EngineListFindElementNode,
  EngineListFirstNode,
  EngineListIsEmptyNode,
  EngineListLastNode,
  EngineListMaxNode,
  EngineListMinNode,
  EngineListFrequencyNode,
  EngineListOddPositionsNode,
  EngineListPrependNode,
  EngineListRemoveFirstNode,
  EngineListRemoveLastNode,
  EngineListReverseNode,
  EnginePulseSequenceNode,
  EngineReduceNode,
  EngineSplitListNode,
  EngineSortListNode,
  EngineZipNode,
  EngineUnzipNode,
} from "../nodes/list-nodes";
import { DataflowEngine } from "../engine";
import {
  EngineBarrierNode,
  EngineGatherNode,
  EngineScatterNode,
} from "../nodes/control-nodes";
import {
  Arc,
  DataToken,
  FirePatterns,
  NodeDefinition,
  PortAddress,
} from "../program-elements";

import { asRecord, isNonEmptyArray } from "../deserialize/utils";
import type {
  RemoteExecutionOp,
  RemoteSubflowPayload,
} from "../deserialize/shared-types";
import type { NodeCompiler, NodeCompilerContext } from "./types";

function parseTransport(data: Record<string, unknown>): "serial" | "bluetooth" {
  const transportRaw = (data.transport ?? data.connectionType) as unknown;
  return transportRaw === "bluetooth" || transportRaw === "serial"
    ? transportRaw
    : "serial";
}

function sanitizeProgramId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 32);
}

function parseMapFilterContextInputCount(
  data: Record<string, unknown>,
): number {
  const raw = data.contextInputCount;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

function mapFilterContextPortIds(contextInputCount: number): string[] {
  return Array.from(
    { length: Math.max(0, contextInputCount) },
    (_, i) => `context${i + 1}`,
  );
}

function argsForMapFilterSubflow(params: {
  item: unknown;
  contextArgs: unknown[];
  selectedInputs: Array<{ nodeId: string; portId: string }>;
}): unknown[] {
  const { item, contextArgs, selectedInputs } = params;
  const invocation = [item, ...contextArgs];
  return selectedInputs.map((_entry, idx) => invocation[idx] ?? null);
}

async function runSubflowPlanOnce(params: {
  plan: {
    engineNodes: unknown[];
    engineArcs: unknown[];
    selectedInputs: Array<{ nodeId: string; portId: string }>;
    outputSources: Array<{ nodeId: string; portId: string }>;
    hasAnyOutput: boolean;
  };
  args: unknown[];
  signal?: AbortSignal;
  onLog?: NodeCompilerContext["onLog"];
  onPrompt?: NodeCompilerContext["onPrompt"];
  onEdgeValue?: NodeCompilerContext["onEdgeValue"];
}): Promise<unknown> {
  const { plan, args, signal, onLog, onPrompt, onEdgeValue } = params;

  const engine = new DataflowEngine({ stepDelayMs: 0 });
  if (onLog || onPrompt || onEdgeValue) {
    engine.setObserver({ onLog, onPrompt, onEdgeValue });
  }

  const baseArcs = plan.engineArcs as Arc[];
  const augmentedArcs = [...baseArcs];
  if (plan.hasAnyOutput) {
    for (const out of plan.outputSources) {
      augmentedArcs.push(
        new Arc(
          new PortAddress(out.nodeId, out.portId),
          new PortAddress("", "out-1"),
          `${out.nodeId}:${out.portId}->out-1`,
        ),
      );
    }
  }

  engine.loadProgram({
    nodes: plan.engineNodes as never[],
    arcs: augmentedArcs,
  });

  const initialTokens = plan.selectedInputs.map(
    (addr, idx) =>
      new DataToken(args[idx], new PortAddress(addr.nodeId, addr.portId)),
  );

  const emitted = await engine.run({
    initialTokens,
    signal,
  });

  if (!plan.hasAnyOutput) return undefined;

  const token = emitted.find(
    (t) => t.location.nodeId === "" && t.location.portId === "out-1",
  );
  return token?.value;
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

export const compileListNodes: NodeCompiler = (flowNode, ctx) => {
  const nodeType = String(flowNode.type);
  const data = asRecord(flowNode.data);
  const executionTarget = data.executionTarget;
  const microbitSlot = parseMicrobitSlot(data);
  const controllerId =
    typeof data.controllerId === "string" ? data.controllerId : "";

  const ensureRemote = (
    op: RemoteExecutionOp,
    ports: string[],
    firePatterns: FirePatterns[],
    stickyInputPorts?: string[],
    mapArgs?: (args: unknown[]) => unknown[],
    subflowFactory?: () => RemoteSubflowPayload | undefined,
  ) => {
    const executor = ctx.remoteExecutor;
    if (!executor) throw new Error("Ejecución remota no configurada.");
    if (!controllerId) throw new Error("No hay controller seleccionado.");

    return new NodeDefinition(
      async (...args: unknown[]) => {
        return executor({
          nodeId: String(flowNode.id),
          controllerId,
          op,
          args: mapArgs ? mapArgs(args) : args,
          ...(subflowFactory ? { subflow: subflowFactory() } : null),
        });
      },
      firePatterns,
      ports,
      stickyInputPorts ? { stickyInputPorts } : undefined,
    );
  };

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

      if (executionTarget === "controller") {
        return ensureRemote(
          "generateSequence",
          ["start", "end", "step", "output"],
          firePatterns,
          ["start", "end", "step"],
        );
      }

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

      if (executionTarget === "controller") {
        return ensureRemote(
          "pulseSequence",
          ["start", "end", "step", "output"],
          firePatterns,
          ["start", "end", "step"],
        );
      }

      return new EnginePulseSequenceNode({
        defaultStart: 1,
        defaultEnd: 10,
        defaultStep: 1,
        firePatterns,
      });
    }

    case NODE_TYPES.ZIP_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "zip",
          ["listA", "listB", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["listA", "listB"],
        );
      }

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
      if (executionTarget === "controller") {
        return ensureRemote(
          "unzip",
          ["inputList", "listA", "listB"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
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
      const contextInputCount = parseMapFilterContextInputCount(data);
      const contextPortIds = mapFilterContextPortIds(contextInputCount);
      const firePatterns = [
        FirePatterns.EXISTS,
        ...contextPortIds.map(() => FirePatterns.EXISTS),
      ];
      const ports = ["inputList", ...contextPortIds, "outputList"];
      const stickyInputPorts = ["inputList", ...contextPortIds];

      if (executionTarget === "controller") {
        if (isNonEmptyArray<Node>(filterNodes) && Array.isArray(filterEdges)) {
          const plan = ctx.helpers.computeSubflowExecutionPlan({
            subflowNodes: filterNodes as Node[],
            subflowEdges: filterEdges as Edge[],
            inCount: contextInputCount + 1,
            outCount: 1,
            onLog: ctx.onLog,
            onPrompt: ctx.onPrompt,
            signal: ctx.signal,
            remoteExecutor: ctx.remoteExecutor,
            runtimeCtx: ctx.subflowRuntimeContext,
          });

          const payload: RemoteSubflowPayload = {
            nodes: filterNodes as Node[],
            edges: filterEdges as Edge[],
            selectedInputs: plan.selectedInputs,
            outputSources: plan.outputSources,
            hasAnyOutput: plan.hasAnyOutput,
          };

          return new NodeDefinition(
            async (inputList: unknown[], ...contextArgs: unknown[]) => {
              const executor = ctx.remoteExecutor;
              if (!executor)
                throw new Error("Ejecución remota no configurada.");
              if (!controllerId)
                throw new Error("No hay controller seleccionado.");

              const items = Array.isArray(inputList) ? inputList : [];
              const output: unknown[] = [];

              for (let i = 0; i < items.length; i += 1) {
                const predicate = await executor({
                  nodeId: String(flowNode.id),
                  controllerId,
                  op: "subflow",
                  args: argsForMapFilterSubflow({
                    item: items[i],
                    contextArgs,
                    selectedInputs: plan.selectedInputs,
                  }),
                  subflow: payload,
                });
                if (predicate) output.push(items[i]);
              }

              return output;
            },
            firePatterns,
            ports,
            { stickyInputPorts, skipStepDelay: true },
          );
        }

        return ensureRemote(
          "filterTruthy",
          ports,
          firePatterns,
          stickyInputPorts,
        );
      }

      if (
        executionTarget === "microbit" &&
        isNonEmptyArray<Node>(filterNodes) &&
        Array.isArray(filterEdges)
      ) {
        const transport = parseTransport(data);
        const plan = ctx.helpers.computeSubflowExecutionPlan({
          subflowNodes: filterNodes as Node[],
          subflowEdges: filterEdges as Edge[],
          inCount: contextInputCount + 1,
          outCount: 1,
          onLog: ctx.onLog,
          onPrompt: ctx.onPrompt,
          signal: ctx.signal,
          remoteExecutor: ctx.remoteExecutor,
          runtimeCtx: ctx.subflowRuntimeContext,
        });

        const programId = sanitizeProgramId(`${String(flowNode.id)}-filter`);

        return new NodeDefinition(
          async (inputList: unknown[], ...contextArgs: unknown[]) => {
            const items = Array.isArray(inputList) ? inputList : [];
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            const output: unknown[] = [];

            for (let i = 0; i < items.length; i += 1) {
              if (ctx.signal?.aborted) {
                const err = new Error("Abortado");
                (err as { name?: string }).name = "AbortError";
                throw err;
              }

              const args = argsForMapFilterSubflow({
                item: items[i],
                contextArgs,
                selectedInputs: plan.selectedInputs,
              });

              const predicate = await sendSubflowToMicrobit({
                connection,
                nodes: filterNodes as Node[],
                edges: filterEdges as Edge[],
                selectedInputs: plan.selectedInputs,
                outputSources: plan.outputSources,
                args,
                programId,
                signal: ctx.signal,
              });

              if (predicate) {
                output.push(items[i]);
              }
            }

            return output;
          },
          firePatterns,
          ports,
          {
            stickyInputPorts,
          },
        );
      }

      if (isNonEmptyArray<Node>(filterNodes) && Array.isArray(filterEdges)) {
        const plan = ctx.helpers.computeSubflowExecutionPlan({
          subflowNodes: filterNodes as Node[],
          subflowEdges: filterEdges as Edge[],
          inCount: contextInputCount + 1,
          outCount: 1,
          onLog: ctx.onLog,
          onPrompt: ctx.onPrompt,
          onEdgeValue: ctx.onEdgeValue,
          signal: ctx.signal,
          remoteExecutor: ctx.remoteExecutor,
          runtimeCtx: ctx.subflowRuntimeContext,
        });

        return new NodeDefinition(
          async (inputList: unknown[], ...contextArgs: unknown[]) => {
            const items = Array.isArray(inputList) ? inputList : [];
            const output: unknown[] = [];

            for (const item of items) {
              const args = argsForMapFilterSubflow({
                item,
                contextArgs,
                selectedInputs: plan.selectedInputs,
              });
              const predicate = await runSubflowPlanOnce({
                plan,
                args,
                signal: ctx.signal,
                onLog: ctx.onLog,
                onPrompt: ctx.onPrompt,
                onEdgeValue: ctx.onEdgeValue,
              });

              if (predicate) {
                output.push(item);
              }
            }

            return output;
          },
          firePatterns,
          ports,
          { stickyInputPorts, skipStepDelay: true },
        );
      }

      return new NodeDefinition(
        (inputList: unknown[]) => {
          const items = Array.isArray(inputList) ? inputList : [];
          return items.filter((item) => Boolean(item));
        },
        firePatterns,
        ports,
        { stickyInputPorts, skipStepDelay: true },
      );
    }

    case NODE_TYPES.MAP_NODE: {
      const mapNodes = data.mapNodes;
      const mapEdges = data.mapEdges;
      const contextInputCount = parseMapFilterContextInputCount(data);
      const contextPortIds = mapFilterContextPortIds(contextInputCount);
      const firePatterns = [
        FirePatterns.EXISTS,
        ...contextPortIds.map(() => FirePatterns.EXISTS),
      ];
      const ports = ["inputList", ...contextPortIds, "outputList"];
      const stickyInputPorts = ["inputList", ...contextPortIds];

      if (executionTarget === "controller") {
        if (isNonEmptyArray<Node>(mapNodes) && Array.isArray(mapEdges)) {
          const plan = ctx.helpers.computeSubflowExecutionPlan({
            subflowNodes: mapNodes as Node[],
            subflowEdges: mapEdges as Edge[],
            inCount: contextInputCount + 1,
            outCount: 1,
            onLog: ctx.onLog,
            onPrompt: ctx.onPrompt,
            signal: ctx.signal,
            remoteExecutor: ctx.remoteExecutor,
            runtimeCtx: ctx.subflowRuntimeContext,
          });

          const payload: RemoteSubflowPayload = {
            nodes: mapNodes as Node[],
            edges: mapEdges as Edge[],
            selectedInputs: plan.selectedInputs,
            outputSources: plan.outputSources,
            hasAnyOutput: plan.hasAnyOutput,
          };

          return new NodeDefinition(
            async (inputList: unknown[], ...contextArgs: unknown[]) => {
              const executor = ctx.remoteExecutor;
              if (!executor)
                throw new Error("Ejecución remota no configurada.");
              if (!controllerId)
                throw new Error("No hay controller seleccionado.");

              const items = Array.isArray(inputList) ? inputList : [];
              const output: unknown[] = [];

              for (let i = 0; i < items.length; i += 1) {
                const mapped = await executor({
                  nodeId: String(flowNode.id),
                  controllerId,
                  op: "subflow",
                  args: argsForMapFilterSubflow({
                    item: items[i],
                    contextArgs,
                    selectedInputs: plan.selectedInputs,
                  }),
                  subflow: payload,
                });
                output.push(mapped);
              }

              return output;
            },
            firePatterns,
            ports,
            { stickyInputPorts, skipStepDelay: true },
          );
        }

        return ensureRemote(
          "mapIdentity",
          ports,
          firePatterns,
          stickyInputPorts,
        );
      }

      if (
        executionTarget === "microbit" &&
        isNonEmptyArray<Node>(mapNodes) &&
        Array.isArray(mapEdges)
      ) {
        const transport = parseTransport(data);
        const plan = ctx.helpers.computeSubflowExecutionPlan({
          subflowNodes: mapNodes as Node[],
          subflowEdges: mapEdges as Edge[],
          inCount: contextInputCount + 1,
          outCount: 1,
          onLog: ctx.onLog,
          onPrompt: ctx.onPrompt,
          signal: ctx.signal,
          remoteExecutor: ctx.remoteExecutor,
          runtimeCtx: ctx.subflowRuntimeContext,
        });

        const programId = sanitizeProgramId(`${String(flowNode.id)}-map`);

        return new NodeDefinition(
          async (inputList: unknown[], ...contextArgs: unknown[]) => {
            const items = Array.isArray(inputList) ? inputList : [];
            const connection = await ensureMicrobitConnected({
              transport,
              slot: microbitSlot,
            });
            const output: unknown[] = [];

            for (let i = 0; i < items.length; i += 1) {
              if (ctx.signal?.aborted) {
                const err = new Error("Abortado");
                (err as { name?: string }).name = "AbortError";
                throw err;
              }

              const args = argsForMapFilterSubflow({
                item: items[i],
                contextArgs,
                selectedInputs: plan.selectedInputs,
              });

              const mapped = await sendSubflowToMicrobit({
                connection,
                nodes: mapNodes as Node[],
                edges: mapEdges as Edge[],
                selectedInputs: plan.selectedInputs,
                outputSources: plan.outputSources,
                args,
                programId,
                signal: ctx.signal,
              });

              output.push(mapped);
            }

            return output;
          },
          firePatterns,
          ports,
          {
            stickyInputPorts,
          },
        );
      }

      if (isNonEmptyArray<Node>(mapNodes) && Array.isArray(mapEdges)) {
        const plan = ctx.helpers.computeSubflowExecutionPlan({
          subflowNodes: mapNodes as Node[],
          subflowEdges: mapEdges as Edge[],
          inCount: contextInputCount + 1,
          outCount: 1,
          onLog: ctx.onLog,
          onPrompt: ctx.onPrompt,
          onEdgeValue: ctx.onEdgeValue,
          signal: ctx.signal,
          remoteExecutor: ctx.remoteExecutor,
          runtimeCtx: ctx.subflowRuntimeContext,
        });

        return new NodeDefinition(
          async (inputList: unknown[], ...contextArgs: unknown[]) => {
            const items = Array.isArray(inputList) ? inputList : [];
            const output: unknown[] = [];

            for (const item of items) {
              const args = argsForMapFilterSubflow({
                item,
                contextArgs,
                selectedInputs: plan.selectedInputs,
              });
              const mapped = await runSubflowPlanOnce({
                plan,
                args,
                signal: ctx.signal,
                onLog: ctx.onLog,
                onPrompt: ctx.onPrompt,
                onEdgeValue: ctx.onEdgeValue,
              });

              output.push(mapped ?? item);
            }

            return output;
          },
          firePatterns,
          ports,
          { stickyInputPorts, skipStepDelay: true },
        );
      }

      return new NodeDefinition(
        (inputList: unknown[]) => {
          const items = Array.isArray(inputList) ? inputList : [];
          return [...items];
        },
        firePatterns,
        ports,
        { stickyInputPorts, skipStepDelay: true },
      );
    }

    case NODE_TYPES.REDUCE_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "reduceSum",
          ["inputList", "output"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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

    case NODE_TYPES.PRODUCT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "reduceProduct",
          ["inputList", "output"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

      if (executionTarget === "microbit") {
        throw new Error("Productorio no está soportado en micro:bit todavía.");
      }

      return new EngineReduceNode((acc, curr) => acc * curr, 1);
    }

    case NODE_TYPES.COUNT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "count",
          ["inputList", "output"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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

    case NODE_TYPES.LIST_FIRST_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listFirst",
          ["inputList", "output"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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

      return new EngineListFirstNode();
    }

    case NODE_TYPES.LIST_LAST_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listLast",
          ["inputList", "output"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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

      return new EngineListLastNode();
    }

    case NODE_TYPES.LIST_MIN_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listMin",
          ["inputList", "output"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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

      return new EngineListMinNode();
    }

    case NODE_TYPES.LIST_MAX_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listMax",
          ["inputList", "output"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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

      return new EngineListMaxNode();
    }

    case NODE_TYPES.LIST_FREQUENCY_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listFrequency",
          ["inputList", "outputList"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "outputList",
        });

        return new NodeDefinition(
          async (inputList: unknown[]) => {
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

      return new EngineListFrequencyNode();
    }

    case NODE_TYPES.LIST_AT_POSITION_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listAtPosition",
          ["inputList", "position", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["inputList", "position"],
        );
      }

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
          async (inputList: unknown[], position: unknown) => {
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
              args: [inputList, position],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["inputList", "position", "output"],
          {
            stickyInputPorts: ["inputList", "position"],
          },
        );
      }

      return new EngineListAtPositionNode();
    }

    case NODE_TYPES.LIST_FIND_ELEMENT_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listFindElement",
          ["inputList", "item", "output"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["inputList", "item"],
        );
      }

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
          async (inputList: unknown[], item: unknown) => {
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
              args: [inputList, item],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["inputList", "item", "output"],
          {
            stickyInputPorts: ["inputList", "item"],
          },
        );
      }

      return new EngineListFindElementNode();
    }

    case NODE_TYPES.LIST_REMOVE_FIRST_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listRemoveFirst",
          ["inputList", "outputList"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "outputList",
        });

        return new NodeDefinition(
          async (inputList: unknown[]) => {
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

      return new EngineListRemoveFirstNode();
    }

    case NODE_TYPES.LIST_REMOVE_LAST_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listRemoveLast",
          ["inputList", "outputList"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "outputList",
        });

        return new NodeDefinition(
          async (inputList: unknown[]) => {
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

      return new EngineListRemoveLastNode();
    }

    case NODE_TYPES.LIST_PREPEND_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listPrepend",
          ["inputList", "item", "outputList"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["inputList", "item"],
        );
      }

      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "outputList",
        });

        return new NodeDefinition(
          async (inputList: unknown[], item: unknown) => {
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
              args: [inputList, item],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["inputList", "item", "outputList"],
          {
            stickyInputPorts: ["inputList", "item"],
          },
        );
      }

      return new EngineListPrependNode();
    }

    case NODE_TYPES.LIST_APPEND_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listAppend",
          ["inputList", "item", "outputList"],
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["inputList", "item"],
        );
      }

      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in-1", "in-2"],
          outputPortId: "outputList",
        });

        return new NodeDefinition(
          async (inputList: unknown[], item: unknown) => {
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
              args: [inputList, item],
              programId: graph.programId,
              signal: ctx.signal,
            });
          },
          [FirePatterns.EXISTS, FirePatterns.EXISTS],
          ["inputList", "item", "outputList"],
          {
            stickyInputPorts: ["inputList", "item"],
          },
        );
      }

      return new EngineListAppendNode();
    }

    case NODE_TYPES.LIST_IS_EMPTY_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listIsEmpty",
          ["inputList", "output"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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

      return new EngineListIsEmptyNode();
    }

    case NODE_TYPES.LIST_REVERSE_NODE: {
      if (executionTarget === "controller") {
        return ensureRemote(
          "listReverse",
          ["inputList", "outputList"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

      if (executionTarget === "microbit") {
        const transport = parseTransport(data);
        const graph = buildMicrobitListGraph({
          nodeId: String(flowNode.id),
          nodeType,
          nodeData: data,
          inputHandles: ["in"],
          outputPortId: "outputList",
        });

        return new NodeDefinition(
          async (inputList: unknown[]) => {
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

      return new EngineListReverseNode();
    }

    case NODE_TYPES.SPLIT_LIST_NODE: {
      return new EngineSplitListNode();
    }

    case NODE_TYPES.LIST_EVEN_POSITIONS_NODE: {
      return new EngineListEvenPositionsNode();
    }

    case "listParityPositions": {
      return new EngineListEvenPositionsNode();
    }

    case NODE_TYPES.LIST_ODD_POSITIONS_NODE: {
      return new EngineListOddPositionsNode();
    }

    case NODE_TYPES.SCATTER_NODE: {
      const rawCount =
        typeof data.outputCount === "number" ? data.outputCount : 0;
      const inferredCount =
        ctx.scatterOutputCountByNodeId?.get(String(flowNode.id)) ?? 0;
      const outputCount = Math.max(rawCount, inferredCount, 0);

      if (executionTarget === "controller") {
        const outputPorts = Array.from(
          { length: outputCount },
          (_v, index) => `output${index + 1}`,
        );
        return ensureRemote(
          "scatter",
          ["inputList", ...outputPorts],
          [FirePatterns.EXISTS],
          ["inputList"],
          (args) => [args[0], outputCount],
        );
      }

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

      if (executionTarget === "controller") {
        const inputPorts = Array.from(
          { length: inputCount },
          (_v, index) => `input${index + 1}`,
        );
        return ensureRemote(
          "gather",
          [...inputPorts, "outputList"],
          firePatterns,
          inputPorts,
        );
      }

      return new EngineGatherNode({ inputCount, firePatterns });
    }

    case NODE_TYPES.BARRIER_NODE: {
      const rawCount = typeof data.portCount === "number" ? data.portCount : 1;
      const inferredCount =
        ctx.barrierPortCountByNodeId?.get(String(flowNode.id)) ?? 1;
      const portCount = Math.max(rawCount, inferredCount, 1);

      const incoming = ctx.barrierIncomingByNodeId?.get(String(flowNode.id));
      const firePatterns = Array.from({ length: portCount }, (_v, idx) => {
        const portId = `input${idx + 1}`;
        return incoming?.has(portId)
          ? FirePatterns.EXISTS
          : FirePatterns.DONT_CARE;
      });

      return new EngineBarrierNode({ portCount, firePatterns });
    }

    case NODE_TYPES.SORT_LIST_NODE: {
      const order = data.order;
      const normalized = order === "desc" ? "desc" : "asc";

      if (executionTarget === "controller") {
        return ensureRemote(
          normalized === "desc" ? "sortListDesc" : "sortListAsc",
          ["inputList", "outputList"],
          [FirePatterns.EXISTS],
          ["inputList"],
        );
      }

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
