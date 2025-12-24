import {
  DataToken,
  ExecuteToken,
  FirePatterns,
  Node,
  PortAddress,
} from "./program-elements";
import { ArcStore, NodeStore, TokenStore } from "./stores";

export class DataflowEngine {
  private arcStore: ArcStore;
  private nodeStore: NodeStore;
  private tokenStore: TokenStore;

  constructor() {
    this.arcStore = new ArcStore();
    this.nodeStore = new NodeStore();
    this.tokenStore = new TokenStore();
  }

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

  transmitUnit<T>(token: DataToken<T>): void {
    const location = token.location;
    const destinations = this.arcStore.findArcsBySource(location);
    destinations.forEach((dest) => {
      this.tokenStore.addToken(new DataToken<T>(token.value, dest.target));
    });
    this.tokenStore.removeToken(token);
  }

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
