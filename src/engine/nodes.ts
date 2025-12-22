type ActivationFunction = (...args: unknown[]) => unknown;

const FirePatterns = {
  EXISTS: "EXISTS",
  EMPTY: "EMPTY",
  DONT_CARE: "DONT_CARE",
  ALWAYS: "ALWAYS",
} as const;

/**
 * The different patterns that can be used to determine if a node should fire
 */
export type FirePatterns = (typeof FirePatterns)[keyof typeof FirePatterns];

/**
 * Defines a unique location of a port within this engine.
 */
export class PortAddress {
  private nodeId: string;
  private portId: string;

  constructor(nodeId: string, portId: string) {
    this.nodeId = nodeId;
    this.portId = portId;
  }
}

/**
 * A container for the data value and its location
 */
export class DataToken<T> {
  private value: T;
  private currentLocation: PortAddress;

  constructor(value: T, currentLocation: PortAddress) {
    this.value = value;
    this.currentLocation = currentLocation;
  }
}

/**
 * A node declaration and definition
 *
 * A single Node Definition may be used to define many run-time nodes
 * that all act the same as the Node Definition
 */
export class NodeDefinition {
  private activationFunction: ActivationFunction;
  private firePatterns: FirePatterns[];
  private ports: string[];

  constructor(
    activationFunction: ActivationFunction,
    firePatterns: FirePatterns[],
    ports: string[]
  ) {
    this.activationFunction = activationFunction;
    this.firePatterns = firePatterns;
    this.ports = ports;
  }
}

/**
 * A run-time node instance
 */
export class Node {
  private id: string;
  private nodeDefinition: NodeDefinition;

  constructor(id: string, nodeDefinition: NodeDefinition) {
    this.id = id;
    this.nodeDefinition = nodeDefinition;
  }
}

/**
 * Combines everything needed to execute a node
 */
export class ExecuteToken {
  private dataTokens: DataToken<unknown>[];
  private node: Node;

  constructor(dataTokens: DataToken<unknown>[], node: Node) {
    this.dataTokens = dataTokens;
    this.node = node;
  }
}

/**
 * A connection between two ports
 */
export class Arc {
  private source: PortAddress;
  private target: PortAddress;

  constructor(source: PortAddress, target: PortAddress) {
    this.source = source;
    this.target = target;
  }
}
