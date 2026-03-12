import { NODE_TYPES } from "@/common/constants";

export type HandleDirection = "source" | "target";

export type MapHandleToPortIdParams = {
  nodeId: string;
  nodeType?: string;
  handleId?: string | null;
  direction: HandleDirection;
};

/**
 * Parses an XYFlow handle id that ends with "-<n>".
 *
 * Examples:
 * - "in-1" -> 1
 * - "out-2" -> 2
 *
 * Returns `null` when the format doesn't match.
 */
export function parseIndexHandle(
  handleId: string | null | undefined,
): number | null {
  if (!handleId) return null;
  const match = /-(\d+)$/.exec(handleId);
  if (!match) return null;
  const idx = Number(match[1]);
  return Number.isFinite(idx) ? idx : null;
}

type MapperParams = Required<
  Pick<MapHandleToPortIdParams, "nodeId" | "direction">
> & {
  nodeType: string;
  handleId?: string | null;
};

type HandleMapper = (params: MapperParams) => string;

function unknownInputHandle(params: {
  nodeId: string;
  nodeType: string;
  handleId: unknown;
}): Error {
  return new Error(
    `Unknown input handle '${String(params.handleId)}' for node ${params.nodeId} (${params.nodeType}).`,
  );
}

function unknownOutputHandle(params: {
  nodeId: string;
  nodeType: string;
  handleId: unknown;
}): Error {
  return new Error(
    `Unknown output handle '${String(params.handleId)}' for node ${params.nodeId} (${params.nodeType}).`,
  );
}

function noInputsAllowed(params: { nodeId: string; nodeType: string }): Error {
  return new Error(
    `Node ${params.nodeId} (${params.nodeType}) should not have input connections.`,
  );
}

function noOutputsAllowed(params: { nodeId: string; nodeType: string }): Error {
  return new Error(
    `Node ${params.nodeId} (${params.nodeType}) should not have outputs.`,
  );
}

function makeTwoInOneOutMapper(): HandleMapper {
  return ({ nodeId, nodeType, handleId, direction }) => {
    if (direction === "target") {
      if (handleId === "in-1") return "input1";
      if (handleId === "in-2") return "input2";
      throw unknownInputHandle({ nodeId, nodeType, handleId });
    }

    if (handleId === "out" || handleId == null) return "output";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  };
}

function makeOneInOneOutMapper(): HandleMapper {
  return ({ nodeId, nodeType, handleId, direction }) => {
    if (direction === "target") {
      if (handleId === "in-1") return "input1";
      throw unknownInputHandle({ nodeId, nodeType, handleId });
    }

    if (handleId === "out" || handleId == null) return "output";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  };
}

const mapperByNodeType: Record<string, HandleMapper> = Object.create(null);

function register(nodeTypes: string[], mapper: HandleMapper): void {
  for (const t of nodeTypes) mapperByNodeType[t] = mapper;
}

// Internal "input value" nodes (used inside Map/Filter embedded editors)
register(
  [
    NODE_TYPES.FILTER_INPUT_VALUE,
    NODE_TYPES.MAP_INPUT_VALUE,
    NODE_TYPES.REPLICATE_INPUT_VALUE,
  ],
  (p) => {
    const { nodeId, nodeType, handleId, direction } = p;
    if (direction === "source") {
      if (handleId === "value" || handleId == null) return "output";
      throw unknownOutputHandle({ nodeId, nodeType, handleId });
    }
    throw noInputsAllowed({ nodeId, nodeType });
  },
);

// Subflow node (indexed in/out handles)
register([NODE_TYPES.SUBFLOW, NODE_TYPES.REPLICATE_FLOW], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  const idx = parseIndexHandle(handleId);
  if (direction === "target") {
    if (handleId?.startsWith("in-") && idx) return `input${idx}`;
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId?.startsWith("out-") && idx) return `output${idx}`;
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Subflow explicit output node
register([NODE_TYPES.SUBFLOW_OUTPUT], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "value" || handleId == null) return "input";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (direction === "source") {
    if (handleId === "value" || handleId == null) return "output";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  }

  throw new Error(`Unsupported direction '${String(direction)}'.`);
});

// Subflow explicit input node
register([NODE_TYPES.SUBFLOW_INPUT], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "source") {
    if (handleId === "value" || handleId == null) return "output";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  }
  throw noInputsAllowed({ nodeId, nodeType });
});

// Input circle nodes: no explicit handle id -> output
register(
  [
    NODE_TYPES.CONSTANT_INPUT,
    NODE_TYPES.CONSTANT_NUMBER_INPUT,
    NODE_TYPES.CONSTANT_BOOLEAN_INPUT,
    NODE_TYPES.CONSTANT_TEXT_INPUT,
    NODE_TYPES.CONSTANT_LIST_INPUT,
    NODE_TYPES.RUNTIME_INPUT,
    NODE_TYPES.RANDOM_INPUT,
    NODE_TYPES.CHOICE_INPUT,
    NODE_TYPES.MICROBIT_READ_BUTTON_INPUT,
    NODE_TYPES.MICROBIT_READ_TEMPERATURE_INPUT,
  ],
  (p) => {
    const { nodeId, nodeType, direction } = p;
    if (direction === "source") return "output";
    throw noInputsAllowed({ nodeId, nodeType });
  },
);

// Timer: optional input -> output after delay
register([NODE_TYPES.TIMER_INPUT], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId == null) return "input";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// IO sink
register([NODE_TYPES.WRITE_SINK], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId == null) return "input1";
    const idx = parseIndexHandle(handleId);
    if (handleId.startsWith("in-") && idx) return `input${idx}`;
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }
  throw noOutputsAllowed({ nodeId, nodeType });
});

// micro:bit sinks
register([NODE_TYPES.MICROBIT_WRITE, NODE_TYPES.MICROBIT_SOUND], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId == null) return "input1";
    const idx = parseIndexHandle(handleId);
    if (handleId.startsWith("in-") && idx) return `input${idx}`;
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }
  throw noOutputsAllowed({ nodeId, nodeType });
});

// Formula editor (dynamic inputs)
register([NODE_TYPES.FORMULA_EDITOR_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    const idx = parseIndexHandle(handleId);
    if (handleId?.startsWith("in-") && idx) return `input${idx}`;
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Processing nodes (2-in 1-out)
register(
  [
    NODE_TYPES.SUM_NODE,
    NODE_TYPES.SUBTRACT_NODE,
    NODE_TYPES.MULTIPLY_NODE,
    NODE_TYPES.DIVIDE_NODE,
    NODE_TYPES.MOD_NODE,
    NODE_TYPES.POWER_NODE,
    NODE_TYPES.MATH_OPERATION_NODE,
    NODE_TYPES.ROOT_NODE,
    NODE_TYPES.LOGARITHM_NODE,
    NODE_TYPES.CONCAT_NODE,
  ],
  makeTwoInOneOutMapper(),
);

register([NODE_TYPES.REPLACE_TEXT_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in-1") return "text";
    if (handleId === "in-2") return "search";
    if (handleId === "in-3") return "replacement";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

register([NODE_TYPES.SUBTRACT_TEXT_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in-1") return "text";
    if (handleId === "in-2") return "search";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Processing nodes (1-in 1-out)
register(
  [NODE_TYPES.FLOOR_NODE, NODE_TYPES.CEILING_NODE, NODE_TYPES.ROUND_NODE],
  makeOneInOneOutMapper(),
);

// Control nodes (2-in 1-out)
register(
  [
    NODE_TYPES.COMPARISON_NODE,
    NODE_TYPES.COMPARISON_EQUAL_NODE,
    NODE_TYPES.COMPARISON_NOT_EQUAL_NODE,
    NODE_TYPES.COMPARISON_LESS_NODE,
    NODE_TYPES.COMPARISON_LESS_OR_EQUAL_NODE,
    NODE_TYPES.COMPARISON_GREATER_NODE,
    NODE_TYPES.COMPARISON_GREATER_OR_EQUAL_NODE,
    NODE_TYPES.AND_NODE,
    NODE_TYPES.NAND_NODE,
    NODE_TYPES.OR_NODE,
    NODE_TYPES.NOR_NODE,
    NODE_TYPES.XOR_NODE,
  ],
  makeTwoInOneOutMapper(),
);

// NOT node
register([NODE_TYPES.NOT_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "input";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out") return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Switch node
register([NODE_TYPES.SWITCH_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "value";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  const idx = parseIndexHandle(handleId);
  if (handleId?.startsWith("out-") && idx) return `output${idx}`;
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Desvio node
register([NODE_TYPES.DESVIO_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "value";
    if (handleId === "in-cond") return "condition";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  const idx = parseIndexHandle(handleId);
  if (handleId?.startsWith("out-") && idx) {
    if (idx === 1) return "output1";
    if (idx === 2) return "output2";
  }

  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Relevo node
register([NODE_TYPES.RELEVO_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "value";
    if (handleId === "in-relay") return "relay";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Conditional node
register([NODE_TYPES.CONDITIONAL_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    const idx = parseIndexHandle(handleId) ?? 1;
    if (handleId?.startsWith("in-") || handleId == null) {
      return `input${idx}`;
    }
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Selector node
register([NODE_TYPES.SELECTOR_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "token") return "token";
    const idx = parseIndexHandle(handleId);
    if (handleId?.startsWith("in-") && idx) return `input${idx}`;
    // Backward compatibility for legacy graphs where selector handles were
    // token-named; preserve original ids when index-based ids are absent.
    if (handleId) return String(handleId);
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  const idx = parseIndexHandle(handleId);
  if (handleId?.startsWith("out-") && idx) return `output${idx}`;
  // Keep legacy "out" mapping for backward compatibility.
  if (handleId === "out" || handleId == null) return "output";
  // Backward compatibility for legacy token-named source handles.
  return String(handleId);
});

// Scatter node: single list input -> N outputs
register([NODE_TYPES.SCATTER_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "inputList";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  const idx = parseIndexHandle(handleId);
  if (handleId?.startsWith("out-") && idx) return `output${idx}`;
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Gather node: N inputs -> single list output
register([NODE_TYPES.GATHER_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    const idx = parseIndexHandle(handleId) ?? 1;
    if (handleId?.startsWith("in-") || handleId == null) {
      return `input${idx}`;
    }
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "outputList";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Iteration/list nodes
register([NODE_TYPES.ZIP_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in-1") return "listA";
    if (handleId === "in-2") return "listB";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

// Unzip node: single input (list of tuples) -> two outputs (listA, listB)
register([NODE_TYPES.UNZIP_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "inputList";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  // source handles: expect out-1 -> listA, out-2 -> listB
  const idx = parseIndexHandle(handleId);
  if (handleId?.startsWith("out-") && idx) {
    if (idx === 1) return "listA";
    if (idx === 2) return "listB";
  }

  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

register(
  [NODE_TYPES.FILTER_NODE, NODE_TYPES.MAP_NODE, NODE_TYPES.SORT_LIST_NODE],
  (p) => {
    const { nodeId, nodeType, handleId, direction } = p;
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "inputList";
      throw unknownInputHandle({ nodeId, nodeType, handleId });
    }

    if (handleId === "out" || handleId == null) return "outputList";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  },
);

register(
  [NODE_TYPES.COUNT_NODE, NODE_TYPES.REDUCE_NODE, NODE_TYPES.PRODUCT_NODE],
  (p) => {
    const { nodeId, nodeType, handleId, direction } = p;
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "inputList";
      throw unknownInputHandle({ nodeId, nodeType, handleId });
    }

    if (handleId === "out" || handleId == null) return "output";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  },
);

register([NODE_TYPES.LIST_FIRST_NODE, NODE_TYPES.LIST_LAST_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "inputList";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

register([NODE_TYPES.LIST_AT_POSITION_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in-1") return "inputList";
    if (handleId === "in-2") return "position";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

register([NODE_TYPES.LIST_FIND_ELEMENT_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in-1") return "inputList";
    if (handleId === "in-2") return "item";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

register(
  [
    NODE_TYPES.LIST_REMOVE_FIRST_NODE,
    NODE_TYPES.LIST_REMOVE_LAST_NODE,
    NODE_TYPES.LIST_REVERSE_NODE,
  ],
  (p) => {
    const { nodeId, nodeType, handleId, direction } = p;
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "inputList";
      throw unknownInputHandle({ nodeId, nodeType, handleId });
    }

    if (handleId === "out" || handleId == null) return "outputList";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  },
);

register([NODE_TYPES.LIST_PREPEND_NODE, NODE_TYPES.LIST_APPEND_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in-1") return "inputList";
    if (handleId === "in-2") return "item";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "outputList";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

register([NODE_TYPES.LIST_IS_EMPTY_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "inputList";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

register([NODE_TYPES.SPLIT_LIST_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in" || handleId == null) return "inputValue";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "outputList";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

register(
  [
    NODE_TYPES.LIST_EVEN_POSITIONS_NODE,
    NODE_TYPES.LIST_ODD_POSITIONS_NODE,
    "listParityPositions",
  ],
  (p) => {
    const { nodeId, nodeType, handleId, direction } = p;
    if (direction === "target") {
      if (handleId === "in" || handleId == null) return "inputList";
      throw unknownInputHandle({ nodeId, nodeType, handleId });
    }

    if (handleId === "out" || handleId == null) return "outputList";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  },
);

register(
  [NODE_TYPES.GENERATE_SEQUENCE_NODE, NODE_TYPES.PULSE_SEQUENCE_NODE],
  (p) => {
    const { nodeId, nodeType, handleId, direction } = p;
    if (direction === "target") {
      if (handleId === "in-1" || handleId == null) return "start";
      if (handleId === "in-2") return "end";
      if (handleId === "in-3") return "step";
      throw unknownInputHandle({ nodeId, nodeType, handleId });
    }

    if (handleId === "out" || handleId == null) return "output";
    throw unknownOutputHandle({ nodeId, nodeType, handleId });
  },
);

register([NODE_TYPES.SLICE_TEXT_NODE], (p) => {
  const { nodeId, nodeType, handleId, direction } = p;
  if (direction === "target") {
    if (handleId === "in-1") return "text";
    if (handleId === "in-2") return "start";
    if (handleId === "in-3") return "end";
    throw unknownInputHandle({ nodeId, nodeType, handleId });
  }

  if (handleId === "out" || handleId == null) return "output";
  throw unknownOutputHandle({ nodeId, nodeType, handleId });
});

/**
 * Maps a UI handle ID (XYFlow) into an engine port ID.
 *
 * This function encodes the contract between the visual nodes (their handle
 * IDs) and the engine node definitions (their port names).
 */
export function mapHandleToPortId(params: MapHandleToPortIdParams): string {
  const nodeType = params.nodeType;
  if (!nodeType) {
    throw new Error(
      `Unsupported node type '${String(params.nodeType)}' for node ${params.nodeId}.`,
    );
  }

  const mapper = mapperByNodeType[nodeType];
  if (!mapper) {
    throw new Error(
      `Unsupported node type '${String(params.nodeType)}' for node ${params.nodeId}.`,
    );
  }

  return mapper({
    nodeId: params.nodeId,
    nodeType,
    handleId: params.handleId,
    direction: params.direction,
  });
}
