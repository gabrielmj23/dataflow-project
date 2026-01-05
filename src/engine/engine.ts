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
export const ENGINE_STEP_DELAY_MS = 0;

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
};

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

export class DataflowEngine {
  private arcStore: ArcStore;
  private nodeStore: NodeStore;
  private tokenStore: TokenStore;
  private observer: EngineObserver | null = null;

  /**
   * Creates a new in-memory dataflow engine with empty stores.
   */
  constructor() {
    this.arcStore = new ArcStore();
    this.nodeStore = new NodeStore();
    this.tokenStore = new TokenStore();
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
    trace?: {
      executedNodeIds?: string[];
      batches?: number;
    };
  }): Promise<DataToken<unknown>[]> {
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

    // Execute in concurrent batches: any nodes that can fire without consuming
    // overlapping tokens are executed together.
    try {
      while (executedSteps < maxSteps) {
        const batch = this.tryEnableBatch({
          maxExecutions: maxSteps - executedSteps,
          skipIfNoConsumptionAndPreviouslyFired: firedWithoutConsumingTokens,
        });

        if (batch.length === 0) {
          break;
        }

        batches += 1;
        if (params.trace && params.trace.batches !== undefined) {
          params.trace.batches = batches;
        }

        const executed = params.trace?.executedNodeIds;
        if (executed) {
          for (const t of batch) {
            executed.push(t.node.id);
          }
        }

        for (const t of batch) {
          if (t.dataTokens.length === 0) {
            firedWithoutConsumingTokens.add(t.node.id);
          }
        }

        executedSteps += batch.length;

        const batchOutputs = await Promise.all(
          batch.map((t) => this.executeUnit(t))
        );
        for (const outputTokens of batchOutputs) {
          for (const outputToken of outputTokens) {
            externalOutputs.push(...this.transmitToken(outputToken));
          }
        }
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

    // Repeat scanning until no more nodes can be scheduled in this batch.
    // This helps capture cases where scheduling one node removes tokens that
    // would otherwise allow another node to fire.
    let progressed = true;
    while (progressed && scheduled.length < maxExecutions) {
      progressed = false;

      for (const node of this.nodeStore.getNodes()) {
        if (scheduled.length >= maxExecutions) {
          break;
        }

        // Never schedule the same node more than once per batch. This avoids
        // infinite filling of a batch for nodes that can fire without consuming
        // tokens (e.g. sources with FirePatterns.ALWAYS).
        if (scheduledNodeIds.has(node.id)) {
          continue;
        }

        const activationTokens = this.collectTokensForNode(node);
        if (!activationTokens) {
          continue;
        }

        if (
          activationTokens.length === 0 &&
          params.skipIfNoConsumptionAndPreviouslyFired?.has(node.id)
        ) {
          continue;
        }

        // If this node would consume any token already reserved for another
        // node in the batch, skip it for this batch.
        const overlaps = activationTokens.some((t) => reserved.has(t));
        if (overlaps) {
          continue;
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
  async executeUnit(token: ExecuteToken): Promise<DataToken<unknown>[]> {
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
    const argValues = nodeDefinition.ports
      .map((portId) =>
        localInputTokens.find((t) => t.location.portId === portId)
      )
      .filter((t): t is DataToken<unknown> => Boolean(t))
      .map((t) => t.value);

    // Optional slow-motion delay to visualize program execution.
    if (ENGINE_STEP_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, ENGINE_STEP_DELAY_MS));
    }

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
      // Invoke activation function with locals
      rawResult = await nodeDefinition.activationFunction(...argValues);
    } catch (error) {
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

    for (let index = 0; index < firePatterns.length; index += 1) {
      const portName = ports[index];
      const pattern = firePatterns[index];

      if (!portName) {
        return null;
      }

      const address = new PortAddress(node.id, portName);
      const portTokens = this.tokenStore.getTokensByAddress(address);

      if (!this.matchesFirePattern(pattern, portTokens)) {
        return null;
      }

      collectedTokens.push(...portTokens);
    }

    return collectedTokens;
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
