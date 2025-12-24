import type { Arc, DataToken, Node, PortAddress } from "./program-elements";

/**
 * A collection of all the Data Tokens in the system
 *
 * Read and written to by the Enable Unit only
 */
export class TokenStore {
  private tokens: DataToken<unknown>[];

  constructor() {
    this.tokens = [];
  }

  addToken(token: DataToken<unknown>): void {
    this.tokens.push(token);
  }

  removeToken(token: DataToken<unknown>): void {
    this.tokens = this.tokens.filter((t) => t !== token);
  }

  removeTokens(tokens: DataToken<unknown>[]): void {
    const toRemove = new Set(tokens);
    this.tokens = this.tokens.filter((t) => !toRemove.has(t));
  }

  getTokensByAddress(address: PortAddress): DataToken<unknown>[] {
    return this.tokens.filter((token) => {
      const location = token.location;
      return (
        location.nodeId === address.nodeId && location.portId === address.portId
      );
    });
  }
}

/**
 * A collection of all the nodes in the system
 */
export class NodeStore {
  private nodes: Node[];

  constructor() {
    this.nodes = [];
  }

  addNode(node: Node): void {
    this.nodes.push(node);
  }

  getNodes(): Node[] {
    return [...this.nodes];
  }

  getNodeById(id: string): Node | undefined {
    return this.nodes.find((node) => node.id === id);
  }
}

/**
 * A collection of all the connections in the system
 */
export class ArcStore {
  private arcs: Arc[];

  constructor() {
    this.arcs = [];
  }

  addArc(arc: Arc): void {
    this.arcs.push(arc);
  }

  findArcsBySource(source: PortAddress): Arc[] {
    return this.arcs.filter((arc) => {
      const arcSource = arc.source;
      return (
        arcSource.nodeId === source.nodeId && arcSource.portId === source.portId
      );
    });
  }
}
