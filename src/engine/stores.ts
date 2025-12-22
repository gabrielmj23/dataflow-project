import type { Arc, DataToken, Node } from "./nodes";

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
}
