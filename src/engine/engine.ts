import {
  DataToken,
  ExecuteToken,
  FirePatterns,
  Node,
  PortAddress,
  Arc,
} from "./program-elements";
import { ArcStore, NodeStore, TokenStore } from "./stores";

export class DataflowEngine {
  private arcStore: ArcStore;
  private nodeStore: NodeStore;
  private tokenStore: TokenStore;

  /**
   * Creates a new in-memory dataflow engine with empty stores.
   */
  constructor() {
    this.arcStore = new ArcStore();
    this.nodeStore = new NodeStore();
    this.tokenStore = new TokenStore();
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
   * Returns tokens that were emitted to non-existent nodes (including the empty
   * node id ""), which can be used as the program's observable outputs.
   */
  async run(params: {
    initialTokens: DataToken<unknown>[];
    maxSteps?: number;
  }): Promise<DataToken<unknown>[]> {
    const maxSteps =
      typeof params.maxSteps === "number" && params.maxSteps > 0
        ? Math.floor(params.maxSteps)
        : 10_000;

    const externalOutputs: DataToken<unknown>[] = [];

    for (const token of params.initialTokens) {
      this.tokenStore.addToken(token);
    }

    for (let step = 0; step < maxSteps; step += 1) {
      const executeToken = this.tryEnableOnce();
      if (!executeToken) {
        break;
      }

      const outputTokens = await this.executeUnit(executeToken);
      for (const outputToken of outputTokens) {
        externalOutputs.push(...this.transmitToken(outputToken));
      }
    }

    return externalOutputs;
  }

  /**
   * Attempts to enable exactly one node execution, consuming any tokens used to
   * satisfy its fire pattern.
   *
   * @returns An {@link ExecuteToken} for the next node to execute, or `null` if
   * no node can currently fire.
   */
  private tryEnableOnce(): ExecuteToken | null {
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

    // Invoke activation function with locals
    const rawResult = await nodeDefinition.activationFunction(...argValues);

    // Normalize outputs to local tokens
    const inputPortIds = new Set(
      token.dataTokens.map((t) => t.location.portId)
    );
    const outputPortIds = nodeDefinition.ports.filter(
      (portId) => !inputPortIds.has(portId)
    );

    const localOutputTokens = this.normalizeToLocalOutputTokens(
      rawResult,
      outputPortIds
    );

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
   * - `unknown[]`: values are mapped to `outputPortIds` by index.
   * - `unknown`: mapped to the first output port.
   */
  private normalizeToLocalOutputTokens(
    result: unknown,
    outputPortIds: string[]
  ): DataToken<unknown>[] {
    // If the node returns local tokens already, keep them.
    if (Array.isArray(result) && result.every((r) => r instanceof DataToken)) {
      return result as DataToken<unknown>[];
    }

    // If the node returns an array of values, map them to output ports in order.
    if (Array.isArray(result)) {
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
