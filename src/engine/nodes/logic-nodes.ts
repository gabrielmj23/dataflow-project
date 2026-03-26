import {
  DataToken,
  FirePatterns,
  NodeDefinition,
  PortAddress,
} from "../program-elements";

type ComparisonOperator = "==" | "!=" | "<" | "<=" | ">" | ">=";

export class EngineComparisonNode extends NodeDefinition {
  constructor(operator: ComparisonOperator) {
    let comparisonFunction: (a: unknown, b: unknown) => boolean;

    switch (operator) {
      case "==":
        comparisonFunction = (a, b) => a === b;
        break;
      case "!=":
        comparisonFunction = (a, b) => a !== b;
        break;
      case "<":
        comparisonFunction = (a, b) => (a as number) < (b as number);
        break;
      case "<=":
        comparisonFunction = (a, b) => (a as number) <= (b as number);
        break;
      case ">":
        comparisonFunction = (a, b) => (a as number) > (b as number);
        break;
      case ">=":
        comparisonFunction = (a, b) => (a as number) >= (b as number);
        break;
    }

    super(
      comparisonFunction,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
    );
  }
}

export class EngineNotNode extends NodeDefinition {
  constructor() {
    super((a: boolean) => !a, [FirePatterns.EXISTS], ["input", "output"]);
  }
}

export class EngineAndNode extends NodeDefinition {
  constructor() {
    super(
      (a: boolean, b: boolean) => a && b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
    );
  }
}

export class EngineNandNode extends NodeDefinition {
  constructor() {
    super(
      (a: boolean, b: boolean) => !(a && b),
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
    );
  }
}

export class EngineOrNode extends NodeDefinition {
  constructor() {
    super(
      (a: boolean, b: boolean) => a || b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
    );
  }
}

export class EngineNorNode extends NodeDefinition {
  constructor() {
    super(
      (a: boolean, b: boolean) => !(a || b),
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
    );
  }
}

export class EngineXorNode extends NodeDefinition {
  constructor() {
    super(
      (a: boolean, b: boolean) => Boolean(a) !== Boolean(b),
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
    );
  }
}

/**
 * Supported operators for the configurable Switch node.
 */
export type SwitchOperator =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "truthy"
  | "falsy";

export type SwitchCondition = {
  operator: SwitchOperator;
  target?: unknown;
};

function parseScalarTarget(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const raw = value.trim();
  if (raw.length === 0) return "";
  if (raw === "true") return true;
  if (raw === "false") return false;

  const n = Number(raw);
  if (Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(raw)) {
    return n;
  }

  return raw;
}

function matchesCondition(value: unknown, condition: SwitchCondition): boolean {
  const op = condition.operator;
  const target = parseScalarTarget(condition.target);

  switch (op) {
    case "truthy":
      return Boolean(value);
    case "falsy":
      return !value;
    case "contains": {
      return String(value ?? "").includes(String(target ?? ""));
    }
    case "startsWith": {
      return String(value ?? "").startsWith(String(target ?? ""));
    }
    case "endsWith": {
      return String(value ?? "").endsWith(String(target ?? ""));
    }
    case "==":
      return value === target;
    case "!=":
      return value !== target;
    case ">":
    case ">=":
    case "<":
    case "<=": {
      const a = typeof value === "number" ? value : Number(value);
      const b = typeof target === "number" ? target : Number(target);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (op === ">") return a > b;
      if (op === ">=") return a >= b;
      if (op === "<") return a < b;
      return a <= b;
    }
    default:
      return false;
  }
}

/**
 * Configurable Switch: evaluates N conditions and emits the input value on the
 * first matching output.
 */
export class EngineSwitchNode extends NodeDefinition {
  constructor(conditions: SwitchCondition[]) {
    const safeConditions = Array.isArray(conditions) ? conditions : [];
    const outputPorts = safeConditions.map((_, i) => `output${i + 1}`);

    super(
      (value: unknown) => {
        for (let i = 0; i < safeConditions.length; i += 1) {
          if (matchesCondition(value, safeConditions[i])) {
            const portId = outputPorts[i] ?? `output${i + 1}`;
            return [new DataToken(value, new PortAddress("", portId))];
          }
        }

        // No default output; drop the token if nothing matches.
        return [];
      },
      [FirePatterns.EXISTS],
      ["value", ...outputPorts],
    );
  }
}

export class EngineDesvioNode extends NodeDefinition {
  constructor() {
    super(
      (value: unknown, condition: unknown) => {
        const targetPort = condition ? "output1" : "output2";
        return [new DataToken(value, new PortAddress("", targetPort))];
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["value", "condition", "output1", "output2"],
      {
        stickyInputPorts: ["value", "condition"],
      },
    );
  }
}

export class EngineRelevoNode extends NodeDefinition {
  constructor() {
    super(
      (_value: unknown, relay: unknown) => {
        return [new DataToken(relay, new PortAddress("", "output"))];
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["value", "relay", "output"],
      {
        stickyInputPorts: ["value", "relay"],
      },
    );
  }
}

export class EngineWhileNode extends NodeDefinition {
  constructor(refreshFlow?: () => Promise<unknown>) {
    let loopStarted = false;

    super(
      async (flow: unknown, condition: unknown, interval: unknown) => {
        const shouldContinue = Boolean(condition);
        const isContinuingIteration = loopStarted && shouldContinue;

        const numericInterval = Number(interval);
        const intervalMs = Number.isFinite(numericInterval)
          ? Math.max(0, Math.round(numericInterval * 1000))
          : 0;

        // First true condition should pass immediately; delay starts on next loop turns.
        if (isContinuingIteration) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        const emitted: DataToken<unknown>[] = [
          new DataToken(condition, new PortAddress("", "loopConditionOut")),
          new DataToken(interval, new PortAddress("", "loopIntervalOut")),
        ];

        if (shouldContinue) {
          let nextFlow = flow;
          if (isContinuingIteration && refreshFlow) {
            const refreshed = await refreshFlow();
            if (refreshed !== undefined) {
              nextFlow = refreshed;
            }
          }

          emitted.push(new DataToken(nextFlow, new PortAddress("", "output")));
          emitted.push(
            new DataToken(nextFlow, new PortAddress("", "loopFlowOut")),
          );

          loopStarted = true;
        } else {
          // Reset the loop state
          loopStarted = false;
        }

        return emitted;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS, FirePatterns.EXISTS],
      [
        "flow",
        "condition",
        "interval",
        "output",
        "loopFlowOut",
        "loopConditionOut",
        "loopIntervalOut",
      ],
      {
        skipStepDelay: true,
        allowParallelTokenExecutions: false,
      },
    );
  }
}
