import {
  Arc,
  DataToken,
  ExecuteToken,
  FirePatterns,
  Node,
  PortAddress,
} from "./program-elements";
import { ArcStore, NodeStore, TokenStore } from "./stores";

// Global artificial delay (in ms) applied before each node execution.
// Set to 0 to disable the slowdown effect.
export const ENGINE_STEP_DELAY_MS = 50;

export type EngineNodeStatus = "waiting" | "running" | "done" | "error";
export type EngineLogLevel = "info" | "error";

export type EngineObserver = {
  onRunStart?: () => void;
  onRunEnd?: (event: { ok: boolean; error?: unknown }) => void;
  onNodeStatus?: (event: {
    nodeId: string;
    status: EngineNodeStatus;
    error?: unknown;
  }) => void;
  onLog?: (event: {
    level: EngineLogLevel;
    nodeId?: string;
    message: string;
    data?: unknown;
  }) => void;
  onPrompt?: (event: {
    nodeId: string;
    prompt: string;
    type: "number" | "text";
    defaultValue?: unknown;
    submit: (value: unknown) => void;
    cancel: () => void;
  }) => void;
};

function coerceTextInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return String(value);
}

function createAbortError(): Error {
  try {
    // Prefer the standard DOMException shape when available.
    return new DOMException("Aborted", "AbortError") as unknown as Error;
  } catch {
    const err = new Error("Aborted");
    (err as { name?: string }).name = "AbortError";
    return err;
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

async function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  throwIfAborted(signal);

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function formatWriteValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function applyWriteTemplate(template: string, values: unknown[]): string {
  return template.replace(/\{(\d+)\}/g, (_match, rawIndex: string) => {
    const idx = Number(rawIndex);
    if (!Number.isFinite(idx) || idx <= 0) return "";
    return formatWriteValue(values[idx - 1]);
  });
}

function coerceNumberInput(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Número inválido.");
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Número inválido.");
    const n = Number(trimmed);
    if (!Number.isFinite(n)) throw new Error("Número inválido.");
    return n;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Número inválido.");
  return n;
}

export class DataflowEngine {
  private arcStore: ArcStore;
  private nodeStore: NodeStore;
  private tokenStore: TokenStore;
  private observer: EngineObserver | null = null;
  // Tracks last input values per node/port for sticky inputs.
  private lastInputValues: Map<string, Map<string, unknown>> = new Map();

  private async awaitRuntimeNumberInput(params: {
    nodeId: string;
    prompt?: string;
    defaultValue?: unknown;
    signal?: AbortSignal;
  }): Promise<number> {
    throwIfAborted(params.signal);

    // If there is no prompt handler, fall back to default value when possible.
    if (!this.observer?.onPrompt) {
      if (params.defaultValue !== undefined) {
        return coerceNumberInput(params.defaultValue);
      }
      throw new Error(
        "No hay UI para solicitar input en runtime (observer.onPrompt no está configurado)."
      );
    }

    const promptText =
      typeof params.prompt === "string" && params.prompt.trim()
        ? params.prompt.trim()
        : "Ingrese un número";

    return await new Promise<number>((resolve, reject) => {
      const signal = params.signal;

      const cleanup = (onAbort?: () => void) => {
        if (onAbort) {
          signal?.removeEventListener("abort", onAbort);
        }
      };

      const onAbort = () => {
        cleanup(onAbort);
        reject(createAbortError());
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }

      signal?.addEventListener("abort", onAbort, { once: true });

      let settled = false;
      const submit = (value: unknown) => {
        if (settled) return;
        settled = true;
        cleanup(onAbort);
        try {
          resolve(coerceNumberInput(value));
        } catch (err) {
          reject(err);
        }
      };

      const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup(onAbort);
        reject(createAbortError());
      };

      this.observer?.onPrompt?.({
        nodeId: params.nodeId,
        prompt: promptText,
        type: "number",
        defaultValue: params.defaultValue,
        submit,
        cancel,
      });
    });
  }

  private async awaitRuntimeTextInput(params: {
    nodeId: string;
    prompt?: string;
    defaultValue?: unknown;
    signal?: AbortSignal;
  }): Promise<string> {
    throwIfAborted(params.signal);

    // If there is no prompt handler, fall back to default value when possible.
    if (!this.observer?.onPrompt) {
      if (params.defaultValue !== undefined) {
        return coerceTextInput(params.defaultValue);
      }
      throw new Error(
        "No hay UI para solicitar input en runtime (observer.onPrompt no está configurado)."
      );
    }

    const promptText =
      typeof params.prompt === "string" && params.prompt.trim()
        ? params.prompt.trim()
        : "Ingrese un texto";

    return await new Promise<string>((resolve, reject) => {
      const signal = params.signal;

      const cleanup = (onAbort?: () => void) => {
        if (onAbort) {
          signal?.removeEventListener("abort", onAbort);
        }
      };

      const onAbort = () => {
        cleanup(onAbort);
        reject(createAbortError());
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }

      signal?.addEventListener("abort", onAbort, { once: true });

      let settled = false;
      const submit = (value: unknown) => {
        if (settled) return;
        settled = true;
        cleanup(onAbort);
        try {
          resolve(coerceTextInput(value));
        } catch (err) {
          reject(err);
        }
      };

      const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup(onAbort);
        reject(createAbortError());
      };

      this.observer?.onPrompt?.({
        nodeId: params.nodeId,
        prompt: promptText,
        type: "text",
        defaultValue: params.defaultValue,
        submit,
        cancel,
      });
    });
  }

  /**
   * Creates a new in-memory dataflow engine with empty stores.
   */
  constructor() {
    this.arcStore = new ArcStore();
    this.nodeStore = new NodeStore();
    this.tokenStore = new TokenStore();
    this.lastInputValues = new Map();
  }

  setObserver(observer: EngineObserver | null): void {
    this.observer = observer;
  }

  /**
   * Replaces the currently loaded program.
   *
   * This resets all internal stores (nodes, arcs, and tokens) and then loads the
   * provided nodes/arcs into the engine.
   */
  loadProgram(params: { nodes: Node[]; arcs: Arc[] }): void {
    this.arcStore = new ArcStore();
    this.nodeStore = new NodeStore();
    this.tokenStore = new TokenStore();
    this.lastInputValues = new Map();

    for (const node of params.nodes) {
      this.nodeStore.addNode(node);
    }
    for (const arc of params.arcs) {
      this.arcStore.addArc(arc);
    }
  }

  /**
   * Executes the currently loaded program until no more nodes can fire.
   *
   * Nodes that can fire concurrently (i.e., they do not contend for the same
   * input tokens) are executed together using `Promise.all`.
   *
   * Returns tokens that were emitted to non-existent nodes (including the empty
   * node id ""), which can be used as the program's observable outputs.
   */
  async run(params: {
    initialTokens: DataToken<unknown>[];
    maxSteps?: number;
    signal?: AbortSignal;
    trace?: {
      executedNodeIds?: string[];
      batches?: number;
    };
  }): Promise<DataToken<unknown>[]> {
    throwIfAborted(params.signal);
    this.observer?.onRunStart?.();

    const maxSteps =
      typeof params.maxSteps === "number" && params.maxSteps > 0
        ? Math.floor(params.maxSteps)
        : 10_000;

    const externalOutputs: DataToken<unknown>[] = [];
    const firedWithoutConsumingTokens = new Set<string>();

    let executedSteps = 0;
    let batches = 0;

    for (const token of params.initialTokens) {
      this.tokenStore.addToken(token);
    }

    // Execute concurrently: any nodes that can fire without consuming
    // overlapping tokens are executed together, and newly-unblocked nodes
    // are scheduled as soon as their dependencies complete.
    try {
      // Active tasks = nodes currently running in parallel.
      // We track them with stable ids so we can remove the first one that
      // completes from the map (Promise.race doesn't tell us which resolved).
      type ActiveResult = { id: number; outputTokens: DataToken<unknown>[] };
      const active = new Map<number, Promise<ActiveResult>>();
      let nextActiveId = 1;

      // Try to schedule as many ready nodes as possible in this moment.
      // Returns true if at least one node was scheduled.
      const scheduleAvailable = (): boolean => {
        if (executedSteps >= maxSteps) return false;

        // Ask the scheduler to produce a batch of nodes that can run now.
        const batch = this.tryEnableBatch({
          maxExecutions: maxSteps - executedSteps,
          skipIfNoConsumptionAndPreviouslyFired: firedWithoutConsumingTokens,
        });

        if (batch.length === 0) {
          return false;
        }

        // Track how many batches we've asked the scheduler for.
        batches += 1;
        if (params.trace && params.trace.batches !== undefined) {
          params.trace.batches = batches;
        }

        // Append scheduled node ids to the trace (if enabled).
        const executed = params.trace?.executedNodeIds;
        if (executed) {
          for (const t of batch) {
            executed.push(t.node.id);
          }
        }

        // Mark nodes that fire without consuming tokens so they don't repeat.
        for (const t of batch) {
          if (t.dataTokens.length === 0) {
            firedWithoutConsumingTokens.add(t.node.id);
          }

          // Start the node immediately and keep a handle to its completion.
          const id = nextActiveId++;
          const promise = this.executeUnit(t, params.signal).then(
            (outputTokens) => ({ id, outputTokens })
          );
          active.set(id, promise);
        }

        // Count scheduled nodes toward the step budget.
        executedSteps += batch.length;
        return true;
      };

      // Prime the engine: schedule anything that is immediately runnable.
      scheduleAvailable();

      while (executedSteps < maxSteps) {
        throwIfAborted(params.signal);

        if (active.size === 0) {
          // Nothing running: try scheduling new work. If none, we are done.
          const scheduled = scheduleAvailable();
          if (!scheduled) {
            break;
          }
        }

        // Wait for the first running node to finish, then propagate its outputs.
        const { id, outputTokens } = await Promise.race(active.values());
        active.delete(id);

        for (const outputToken of outputTokens) {
          externalOutputs.push(...this.transmitToken(outputToken));
        }

        // Newly produced tokens may unblock more nodes; schedule them now.
        scheduleAvailable();
      }

      this.observer?.onRunEnd?.({ ok: true });
      return externalOutputs;
    } catch (error) {
      this.observer?.onRunEnd?.({ ok: false, error });
      throw error;
    }
  }

  /**
   * Attempts to enable a set of nodes that can execute concurrently.
   *
   * A node is considered safe to batch with others if the tokens it consumes do
   * not overlap with tokens already reserved for this batch.
   */
  private tryEnableBatch(params: {
    maxExecutions: number;
    skipIfNoConsumptionAndPreviouslyFired?: Set<string>;
  }): ExecuteToken[] {
    const maxExecutions = Math.max(0, Math.floor(params.maxExecutions));
    if (maxExecutions === 0) {
      return [];
    }

    const reserved = new Set<DataToken<unknown>>();
    const scheduled: ExecuteToken[] = [];
    const scheduledNodeIds = new Set<string>();
    let runtimeInputScheduled = false;

    const isRuntimeInputSource = (node: Node): boolean => {
      const def = node.nodeDefinition;
      if (def.meta.kind !== "runtimeInput") return false;
      return (
        def.firePatterns.length === 1 &&
        def.firePatterns[0] === FirePatterns.ALWAYS &&
        def.ports.length === 1
      );
    };

    const hasTokenAvailable = (address: PortAddress): boolean => {
      const present = this.tokenStore.getTokensByAddress(address);
      if (present.length > 0) return true;
      for (const t of reserved) {
        if (
          t.location.nodeId === address.nodeId &&
          t.location.portId === address.portId
        ) {
          return true;
        }
      }
      return false;
    };

    const getIncomingArcs = (target: PortAddress) => {
      return this.arcStore
        .getArcs()
        .filter(
          (a) =>
            a.target.nodeId === target.nodeId && a.target.portId === target.portId
        );
    };

    const computeDemandedRuntimeInputs = (): Set<string> => {
      const demanded = new Set<string>();

      for (const consumer of this.nodeStore.getNodes()) {
        const def = consumer.nodeDefinition;
        const firePatterns = def.firePatterns;
        const ports = def.ports;

        const missingRuntimeInputs = new Set<string>();
        let missingCount = 0;
        let satisfiable = true;

        for (let index = 0; index < firePatterns.length; index += 1) {
          const portName = ports[index];
          const pattern = firePatterns[index];
          if (!portName) {
            satisfiable = false;
            break;
          }

          if (pattern !== FirePatterns.EXISTS) {
            continue;
          }

          const address = new PortAddress(consumer.id, portName);
          if (hasTokenAvailable(address)) {
            continue;
          }

          missingCount += 1;
          const incoming = getIncomingArcs(address);
          if (incoming.length === 0) {
            satisfiable = false;
            break;
          }

          // If this missing port can be satisfied by a runtimeInput source node,
          // then we can demand that runtimeInput. Otherwise, defer.
          const runtimeIncoming = incoming
            .map((a) => this.nodeStore.getNodeById(a.source.nodeId))
            .filter((n): n is Node => Boolean(n))
            .filter((n) => isRuntimeInputSource(n));

          if (runtimeIncoming.length === 0) {
            satisfiable = false;
            break;
          }

          for (const src of runtimeIncoming) {
            missingRuntimeInputs.add(src.id);
          }
        }

        // Only demand prompts when the consumer is actually blocked AND
        // the only missing inputs are runtimeInput values.
        if (satisfiable && missingCount > 0) {
          for (const id of missingRuntimeInputs) demanded.add(id);
        }
      }

      return demanded;
    };

    // Repeat scanning until no more nodes can be scheduled in this batch.
    // This helps capture cases where scheduling one node removes tokens that
    // would otherwise allow another node to fire.
    let progressed = true;
    while (progressed && scheduled.length < maxExecutions) {
      progressed = false;

      const demandedRuntimeInputs = computeDemandedRuntimeInputs();

      const tryScheduleNode = (node: Node): boolean => {
        if (scheduled.length >= maxExecutions) {
          return false;
        }

        // Never schedule the same node more than once per batch. This avoids
        // infinite filling of a batch for nodes that can fire without consuming
        // tokens (e.g. sources with FirePatterns.ALWAYS).
        if (scheduledNodeIds.has(node.id)) {
          return false;
        }

        const activationTokens = this.collectTokensForNode(node);
        if (!activationTokens) {
          return false;
        }

        if (
          activationTokens.length === 0 &&
          params.skipIfNoConsumptionAndPreviouslyFired?.has(node.id)
        ) {
          return false;
        }

        // If this node would consume any token already reserved for another
        // node in the batch, skip it for this batch.
        const overlaps = activationTokens.some((t) => reserved.has(t));
        if (overlaps) {
          return false;
        }

        // Reserve and consume tokens now.
        for (const t of activationTokens) {
          reserved.add(t);
        }
        this.tokenStore.removeTokens(activationTokens);

        const executeNode = new Node(node.id, node.nodeDefinition.clone());
        scheduled.push(new ExecuteToken(activationTokens, executeNode));
        scheduledNodeIds.add(node.id);
        progressed = true;
        return true;
      };

      // First, schedule non-runtime nodes. This allows ready flows to proceed
      // before asking for the next runtime input.
      for (const node of this.nodeStore.getNodes()) {
        if (scheduled.length >= maxExecutions) break;
        if (isRuntimeInputSource(node)) continue;
        tryScheduleNode(node);
      }

      // If nothing else could run, schedule a single runtime input (if demanded).
      if (!progressed && !runtimeInputScheduled) {
        for (const node of this.nodeStore.getNodes()) {
          if (scheduled.length >= maxExecutions) break;
          if (!isRuntimeInputSource(node)) continue;
          if (!demandedRuntimeInputs.has(node.id)) continue;
          if (tryScheduleNode(node)) {
            runtimeInputScheduled = true;
            break;
          }
        }
      }
    }

    return scheduled;
  }

  /**
   * Routes a single produced token through outgoing arcs.
   *
   * Internal destinations are enqueued into the token store. Destinations that
   * refer to a non-existent node id (including "") are returned as external
   * outputs.
   */
  private transmitToken(token: DataToken<unknown>): DataToken<unknown>[] {
    const location = token.location;
    const destinations = this.arcStore.findArcsBySource(location);

    if (destinations.length === 0) {
      return [];
    }

    const external: DataToken<unknown>[] = [];

    destinations.forEach((arc) => {
      const target = arc.target;
      const next = new DataToken<unknown>(token.value, target);

      const isInternal =
        target.nodeId !== "" &&
        this.nodeStore.getNodeById(target.nodeId) !== undefined;

      if (isInternal) {
        this.tokenStore.addToken(next);
      } else {
        external.push(next);
      }
    });

    return external;
  }

  /**
   * Splits a token into either a local output (address targets a loaded node) or
   * an external output (address targets no loaded node).
   *
   * This is useful when interfacing the engine with an external runtime.
   */
  ioUnit<T>(token: DataToken<T>): {
    localOutput: DataToken<T> | null;
    externalOutput: DataToken<T> | null;
  } {
    const location = token.location;
    const isInternalAddress =
      location.nodeId !== "" &&
      this.nodeStore.getNodeById(location.nodeId) !== undefined;

    const cloned = new DataToken<T>(
      token.value,
      new PortAddress(location.nodeId, location.portId)
    );

    if (isInternalAddress) {
      return { localOutput: cloned, externalOutput: null };
    }

    return { localOutput: null, externalOutput: cloned };
  }

  /**
   * Transmits a token through all outgoing arcs and removes it from the token
   * store.
   *
   * Note: unlike {@link run} / {@link transmitToken}, this method does not
   * surface "external" outputs; it only enqueues internal destinations.
   */
  transmitUnit<T>(token: DataToken<T>): void {
    const location = token.location;
    const destinations = this.arcStore.findArcsBySource(location);
    destinations.forEach((dest) => {
      this.tokenStore.addToken(new DataToken<T>(token.value, dest.target));
    });
    this.tokenStore.removeToken(token);
  }

  /**
   * Adds a token to the token store and checks if any node can fire.
   *
   * If a node can fire, the required tokens are consumed and returned inside an
   * {@link ExecuteToken}.
   */
  enableUnit<T>(token: DataToken<T>): ExecuteToken | null {
    this.tokenStore.addToken(token);

    for (const node of this.nodeStore.getNodes()) {
      const activationTokens = this.collectTokensForNode(node);

      if (!activationTokens) {
        continue;
      }

      this.tokenStore.removeTokens(activationTokens);
      const executeNode = new Node(node.id, node.nodeDefinition.clone());
      return new ExecuteToken(activationTokens, executeNode);
    }

    return null;
  }

  /**
   * Executes a single enabled node and returns the produced global output tokens.
   *
   * Execution details:
   * - Converts global input tokens to local tokens (node id stripped).
   * - Orders arguments according to the node's declared port list.
   * - Invokes the node's activation function.
   * - Normalizes the result into local output tokens and re-attaches the node id.
   */
  async executeUnit(
    token: ExecuteToken,
    signal?: AbortSignal
  ): Promise<DataToken<unknown>[]> {
    throwIfAborted(signal);
    const node = token.node;
    const nodeDefinition = node.nodeDefinition;

    this.observer?.onNodeStatus?.({ nodeId: node.id, status: "running" });

    // Global -> Local (strip node id, keep port id + value)
    const localInputTokens = token.dataTokens.map(
      (globalToken) =>
        new DataToken(
          globalToken.value,
          new PortAddress("", globalToken.location.portId)
        )
    );

    // Order arguments by the node's declared port order.
    // Keep positional alignment with declared ports; allow missing inputs as undefined
    const argValues = nodeDefinition.ports.map((portId) => {
      const tok = localInputTokens.find((t) => t.location.portId === portId);
      return tok ? tok.value : undefined;
    });

    // Optional slow-motion delay to visualize program execution.
    if (ENGINE_STEP_DELAY_MS > 0) {
      await abortableDelay(ENGINE_STEP_DELAY_MS, signal);
    }

    throwIfAborted(signal);

    // Surface write-node outputs to observers (frontend console)
    if (nodeDefinition.meta.kind === "write") {
      const template = nodeDefinition.meta.template || "{1}";
      this.observer?.onLog?.({
        level: "info",
        nodeId: node.id,
        message: "write",
        data: applyWriteTemplate(template, argValues),
      });
    }

    let rawResult: unknown;
    try {
      if (nodeDefinition.meta.kind === "runtimeInput") {
        const inputType = nodeDefinition.meta.runtimeInputType ?? "number";
        if (inputType === "text") {
          rawResult = await this.awaitRuntimeTextInput({
            nodeId: node.id,
            prompt: nodeDefinition.meta.runtimePrompt,
            defaultValue: nodeDefinition.meta.runtimeDefaultValue,
            signal,
          });
        } else {
          rawResult = await this.awaitRuntimeNumberInput({
            nodeId: node.id,
            prompt: nodeDefinition.meta.runtimePrompt,
            defaultValue: nodeDefinition.meta.runtimeDefaultValue,
            signal,
          });
        }
      } else {
        // Invoke activation function with locals
        rawResult = await nodeDefinition.activationFunction(...argValues);
      }
    } catch (error) {
      // Cancellation should not be surfaced as a node error/log.
      if ((error as { name?: unknown } | null)?.name === "AbortError") {
        throw error;
      }
      this.observer?.onNodeStatus?.({
        nodeId: node.id,
        status: "error",
        error,
      });
      this.observer?.onLog?.({
        level: "error",
        nodeId: node.id,
        message: "error",
        data: error,
      });
      // Do not propagate the error to the whole program run. By returning
      // no output tokens, this effectively cuts the execution of this
      // particular flow, while allowing other independent flows to
      // continue executing.
      return [];
    }

    throwIfAborted(signal);

    // Normalize outputs to local tokens
    const inferredInputCount = (() => {
      const firePatterns = nodeDefinition.firePatterns;
      const ports = nodeDefinition.ports;

      // Source nodes are represented as FirePatterns.ALWAYS with a single
      // "output" port. They consume zero tokens and still have one output.
      if (
        firePatterns.length === 1 &&
        firePatterns[0] === FirePatterns.ALWAYS &&
        ports.length === 1
      ) {
        return 0;
      }

      return firePatterns.length;
    })();

    const outputPortIds = nodeDefinition.ports.slice(inferredInputCount);

    const localOutputTokens = this.normalizeToLocalOutputTokens(
      rawResult,
      outputPortIds
    );

    this.observer?.onNodeStatus?.({ nodeId: node.id, status: "done" });

    // Local -> Global (add current node id back)
    return localOutputTokens.map(
      (localToken) =>
        new DataToken(
          localToken.value,
          new PortAddress(node.id, localToken.location.portId)
        )
    );
  }

  /**
   * Normalizes an activation function result into local output tokens.
   *
   * Supported return shapes:
   * - `DataToken[]`: returned as-is (assumed to be local tokens).
   * - `unknown[]`: if there are multiple output ports, values are mapped to
   *   `outputPortIds` by index. If there is exactly one output port, the array
   *   is treated as a single value (useful for list outputs).
   * - `unknown`: mapped to the first output port.
   */
  private normalizeToLocalOutputTokens(
    result: unknown,
    outputPortIds: string[]
  ): DataToken<unknown>[] {
    // If the node returns local tokens already, keep them.
    // NOTE: `[].every(...)` is `true`, so we must require a non-empty array to
    // avoid interpreting an empty list value (`[]`) as "no output tokens".
    if (
      Array.isArray(result) &&
      result.length > 0 &&
      result.every((r) => r instanceof DataToken)
    ) {
      return result as DataToken<unknown>[];
    }

    // If the node returns an array:
    // - with 1 output port, treat the entire array as a single value (e.g. lists)
    // - with N output ports, treat it as N positional outputs
    if (Array.isArray(result)) {
      if (outputPortIds.length === 0) {
        return [];
      }

      if (outputPortIds.length === 1) {
        return [new DataToken(result, new PortAddress("", outputPortIds[0]))];
      }

      return result
        .slice(0, outputPortIds.length)
        .map(
          (value, index) =>
            new DataToken(
              value,
              new PortAddress("", outputPortIds[index] ?? "output")
            )
        );
    }

    // Single value: map to first output port (or "output" as fallback).
    if (outputPortIds.length === 0) {
      return [];
    }

    return [new DataToken(result, new PortAddress("", outputPortIds[0]))];
  }

  /**
   * Collects all tokens required for a node to fire according to its fire
   * patterns.
   *
   * @returns The tokens that satisfy the fire patterns, or `null` if the node
   * cannot fire with the current token store.
   */
  private collectTokensForNode(node: Node): DataToken<unknown>[] | null {
    const nodeDefinition = node.nodeDefinition;
    const firePatterns = nodeDefinition.firePatterns;
    const ports = nodeDefinition.ports;
    const collectedTokens: DataToken<unknown>[] = [];
    const stickyPorts = nodeDefinition.meta.stickyInputPorts ?? [];

    // For nodes with sticky inputs, only allow firing when there is at least
    // one *new* token available on an EXISTS port. Sticky values are then
    // reused for other EXISTS ports that lack a fresh token in this step.
    if (stickyPorts.length > 0) {
      let hasRealToken = false;
      for (let index = 0; index < firePatterns.length; index += 1) {
        const portName = ports[index];
        const pattern = firePatterns[index];
        if (!portName || pattern !== FirePatterns.EXISTS) continue;

        const address = new PortAddress(node.id, portName);
        const portTokens = this.tokenStore.getTokensByAddress(address);
        if (portTokens.length > 0) {
          hasRealToken = true;
          break;
        }
      }

      if (!hasRealToken) {
        return null;
      }
    }

    for (let index = 0; index < firePatterns.length; index += 1) {
      const portName = ports[index];
      const pattern = firePatterns[index];

      if (!portName) {
        return null;
      }

      const address = new PortAddress(node.id, portName);
      const portTokens = this.tokenStore.getTokensByAddress(address);
      const isSticky = stickyPorts.includes(portName);

      // Queue-style semantics per port, with optional sticky behavior.
      switch (pattern) {
        case FirePatterns.EXISTS: {
          if (portTokens.length > 0) {
            // Consume only the oldest token for this port in this execution.
            const token = portTokens[0];
            collectedTokens.push(token);

            if (isSticky) {
              this.rememberLastInput(node.id, portName, token.value);
            }
            break;
          }

          if (isSticky) {
            const stickyToken = this.getStickyToken(node.id, portName);
            if (!stickyToken) {
              return null;
            }
            collectedTokens.push(stickyToken);
            break;
          }

          return null;
        }
        case FirePatterns.EMPTY: {
          if (portTokens.length !== 0) {
            return null;
          }
          break;
        }
        case FirePatterns.ALWAYS:
        case FirePatterns.DONT_CARE: {
          // These patterns never block firing and do not consume tokens.
          break;
        }
        default: {
          if (!this.matchesFirePattern(pattern, portTokens)) {
            return null;
          }
        }
      }
    }

    return collectedTokens;
  }

  private rememberLastInput(
    nodeId: string,
    portId: string,
    value: unknown
  ): void {
    let byPort = this.lastInputValues.get(nodeId);
    if (!byPort) {
      byPort = new Map<string, unknown>();
      this.lastInputValues.set(nodeId, byPort);
    }
    byPort.set(portId, value);
  }

  private getStickyToken(
    nodeId: string,
    portId: string
  ): DataToken<unknown> | null {
    const byPort = this.lastInputValues.get(nodeId);
    const value = byPort?.get(portId);
    if (value === undefined) {
      return null;
    }
    return new DataToken<unknown>(value, new PortAddress(nodeId, portId));
  }

  /**
   * Evaluates whether a port's available tokens satisfy a given fire pattern.
   */
  private matchesFirePattern(
    pattern: FirePatterns,
    tokens: DataToken<unknown>[]
  ): boolean {
    switch (pattern) {
      case FirePatterns.EXISTS:
        return tokens.length > 0;
      case FirePatterns.EMPTY:
        return tokens.length === 0;
      case FirePatterns.ALWAYS:
      case FirePatterns.DONT_CARE:
        return true;
      default:
        return false;
    }
  }
}
