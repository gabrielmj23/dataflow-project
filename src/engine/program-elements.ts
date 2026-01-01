/**
 * Function that defines the behavior of a node
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActivationFunction = (...args: any[]) => unknown;

export const FirePatterns = {
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
  private _nodeId: string;
  private _portId: string;

  constructor(nodeId: string, portId: string) {
    this._nodeId = nodeId;
    this._portId = portId;
  }

  get nodeId(): string {
    return this._nodeId;
  }

  get portId(): string {
    return this._portId;
  }
}

/**
 * A container for the data value and its location
 */
export class DataToken<T> {
  private _value: T;
  private _currentLocation: PortAddress;

  constructor(value: T, currentLocation: PortAddress) {
    this._value = value;
    this._currentLocation = currentLocation;
  }

  get value(): T {
    return this._value;
  }

  get location(): PortAddress {
    return this._currentLocation;
  }
}

/**
 * A node declaration and definition
 *
 * A single Node Definition may be used to define many run-time nodes
 * that all act the same as the Node Definition
 */
export class NodeDefinition {
  private _activationFunction: ActivationFunction;
  private _firePatterns: FirePatterns[];
  private _ports: string[];
  private _meta: { kind?: string };

  constructor(
    activationFunction: ActivationFunction,
    firePatterns: FirePatterns[],
    ports: string[],
    meta?: { kind?: string }
  ) {
    this._activationFunction = activationFunction;
    this._firePatterns = firePatterns;
    this._ports = ports;
    this._meta = meta ?? {};
  }

  get activationFunction(): ActivationFunction {
    return this._activationFunction;
  }

  get firePatterns(): FirePatterns[] {
    return [...this._firePatterns];
  }

  get ports(): string[] {
    return [...this._ports];
  }

  get meta(): { kind?: string } {
    return { ...this._meta };
  }

  public clone(): NodeDefinition {
    return new NodeDefinition(
      this.activationFunction,
      [...this.firePatterns],
      [...this.ports],
      this.meta
    );
  }
}

/**
 * A run-time node instance
 */
export class Node {
  private _id: string;
  private _nodeDefinition: NodeDefinition;

  constructor(id: string, nodeDefinition: NodeDefinition) {
    this._id = id;
    this._nodeDefinition = nodeDefinition;
  }

  get id(): string {
    return this._id;
  }

  get nodeDefinition(): NodeDefinition {
    return this._nodeDefinition;
  }
}

/**
 * Combines everything needed to execute a node
 */
export class ExecuteToken {
  private _dataTokens: DataToken<unknown>[];
  private _node: Node;

  constructor(dataTokens: DataToken<unknown>[], node: Node) {
    this._dataTokens = dataTokens;
    this._node = node;
  }

  get dataTokens(): DataToken<unknown>[] {
    return this._dataTokens;
  }

  get node(): Node {
    return this._node;
  }
}

/**
 * A connection between two ports
 */
export class Arc {
  private _source: PortAddress;
  private _target: PortAddress;

  constructor(source: PortAddress, target: PortAddress) {
    this._source = source;
    this._target = target;
  }

  get source(): PortAddress {
    return this._source;
  }

  get target(): PortAddress {
    return this._target;
  }
}
