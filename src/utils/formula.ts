import { all, create, type MathNode } from "mathjs";

const math = create(all, { number: "number" });

export type FormulaCompiled = {
  evaluate: (scope?: Record<string, unknown>) => unknown;
};

export type FormulaValidationResult = {
  ok: boolean;
  error?: string;
  variables: string[];
  compiled?: FormulaCompiled;
};

export type FormulaFunctionGuideItem = {
  name: string;
  labelEs: string;
  signature: string;
  min: number;
  max?: number;
};

export type FormulaOperatorGuideItem = {
  symbol: string;
  labelEs: string;
};

export type FormulaValidationMode = "logic" | "arithmetic";

type FormulaEvaluateResult = number | boolean;

type FormulaModeStrategy = {
  mode: FormulaValidationMode;
  allowBooleanConstants: boolean;
  allowedOperators: ReadonlySet<string>;
  operatorGuide: readonly FormulaOperatorGuideItem[];
  functionGuide: readonly FormulaFunctionGuideItem[];
  evaluateResult: (value: unknown) => FormulaEvaluateResult;
};

type ValidateFormulaOptions = {
  mode?: FormulaValidationMode;
};

const COMMON_FUNCTION_GUIDE: readonly FormulaFunctionGuideItem[] = [
  {
    name: "sqrt",
    labelEs: "Raiz cuadrada",
    signature: "sqrt(a)",
    min: 1,
    max: 1,
  },
  {
    name: "abs",
    labelEs: "Valor absoluto",
    signature: "abs(a)",
    min: 1,
    max: 1,
  },
  {
    name: "exp",
    labelEs: "Exponencial",
    signature: "exp(a)",
    min: 1,
    max: 1,
  },
  {
    name: "log",
    labelEs: "Logaritmo",
    signature: "log(a) o log(a, b)",
    min: 1,
    max: 2,
  },
  {
    name: "ln",
    labelEs: "Logaritmo natural",
    signature: "ln(a)",
    min: 1,
    max: 1,
  },
  {
    name: "pow",
    labelEs: "Potencia",
    signature: "pow(a, b)",
    min: 2,
    max: 2,
  },
  {
    name: "min",
    labelEs: "Minimo",
    signature: "min(a, b, ...)",
    min: 2,
  },
  {
    name: "max",
    labelEs: "Maximo",
    signature: "max(a, b, ...)",
    min: 2,
  },
  {
    name: "round",
    labelEs: "Redondeo",
    signature: "round(a)",
    min: 1,
    max: 1,
  },
  {
    name: "floor",
    labelEs: "Piso",
    signature: "floor(a)",
    min: 1,
    max: 1,
  },
  {
    name: "ceil",
    labelEs: "Techo",
    signature: "ceil(a)",
    min: 1,
    max: 1,
  },
  {
    name: "sin",
    labelEs: "Seno",
    signature: "sin(a)",
    min: 1,
    max: 1,
  },
  {
    name: "cos",
    labelEs: "Coseno",
    signature: "cos(a)",
    min: 1,
    max: 1,
  },
  {
    name: "tan",
    labelEs: "Tangente",
    signature: "tan(a)",
    min: 1,
    max: 1,
  },
  {
    name: "asin",
    labelEs: "Arcoseno",
    signature: "asin(a)",
    min: 1,
    max: 1,
  },
  {
    name: "acos",
    labelEs: "Arcocoseno",
    signature: "acos(a)",
    min: 1,
    max: 1,
  },
  {
    name: "atan",
    labelEs: "Arcotangente",
    signature: "atan(a)",
    min: 1,
    max: 1,
  },
];

const ALLOWED_FUNCTIONS = new Map<string, { min: number; max?: number }>(
  COMMON_FUNCTION_GUIDE.map((fn) => [fn.name, { min: fn.min, max: fn.max }]),
);

const ARITHMETIC_OPERATOR_GUIDE: readonly FormulaOperatorGuideItem[] = [
  { symbol: "+", labelEs: "Suma" },
  { symbol: "-", labelEs: "Resta" },
  { symbol: "*", labelEs: "Multiplicación" },
  { symbol: "/", labelEs: "División" },
  { symbol: "^", labelEs: "Potencia" },
];

const LOGIC_OPERATOR_GUIDE: readonly FormulaOperatorGuideItem[] = [
  ...ARITHMETIC_OPERATOR_GUIDE,
  { symbol: ">", labelEs: "Mayor que" },
  { symbol: "<", labelEs: "Menor que" },
  { symbol: ">=", labelEs: "Mayor o igual" },
  { symbol: "<=", labelEs: "Menor o igual" },
  { symbol: "==", labelEs: "Igual" },
  { symbol: "!=", labelEs: "Distinto" },
  { symbol: "and", labelEs: "Y lógico" },
  { symbol: "or", labelEs: "O lógico" },
];

const ARITHMETIC_OPERATOR_KEYS = new Set([
  "+",
  "-",
  "unaryPlus",
  "unaryMinus",
  "*",
  "/",
  "^",
]);

const LOGIC_OPERATOR_KEYS = new Set([
  ...ARITHMETIC_OPERATOR_KEYS,
  ">",
  "<",
  ">=",
  "<=",
  "==",
  "!=",
  "and",
  "or",
]);

const FORMULA_STRATEGIES: Record<FormulaValidationMode, FormulaModeStrategy> = {
  arithmetic: {
    mode: "arithmetic",
    allowBooleanConstants: false,
    allowedOperators: ARITHMETIC_OPERATOR_KEYS,
    operatorGuide: ARITHMETIC_OPERATOR_GUIDE,
    functionGuide: COMMON_FUNCTION_GUIDE,
    evaluateResult: (value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error("Resultado no válido.");
      }
      return num;
    },
  },
  logic: {
    mode: "logic",
    allowBooleanConstants: true,
    allowedOperators: LOGIC_OPERATOR_KEYS,
    operatorGuide: LOGIC_OPERATOR_GUIDE,
    functionGuide: COMMON_FUNCTION_GUIDE,
    evaluateResult: (value) => {
      if (typeof value === "boolean") {
        return value;
      }

      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error("Resultado lógico no válido.");
      }

      return num !== 0;
    },
  },
};

export function getFormulaStrategy(
  mode: FormulaValidationMode,
): FormulaModeStrategy {
  return FORMULA_STRATEGIES[mode];
}

export function getFormulaFunctionGuide(
  mode: FormulaValidationMode,
): FormulaFunctionGuideItem[] {
  return [...getFormulaStrategy(mode).functionGuide];
}

export function getFormulaOperatorGuide(
  mode: FormulaValidationMode,
): FormulaOperatorGuideItem[] {
  return [...getFormulaStrategy(mode).operatorGuide];
}

// Backward-compatible exports used by arithmetic formula node.
export const FORMULA_FUNCTION_GUIDE: FormulaFunctionGuideItem[] =
  getFormulaFunctionGuide("arithmetic");
export const FORMULA_OPERATOR_GUIDE: FormulaOperatorGuideItem[] =
  getFormulaOperatorGuide("arithmetic");

function isFiniteNumber(value: unknown): boolean {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num);
}

function validateNode(params: {
  node: MathNode;
  variables: string[];
  seen: Set<string>;
  strategy: FormulaModeStrategy;
}): { ok: boolean; error?: string } {
  const { node, variables, seen, strategy } = params;
  const anyNode = node as MathNode & { [key: string]: unknown };

  if ((anyNode as { isOperatorNode?: boolean }).isOperatorNode) {
    const op = String((anyNode as { op?: unknown }).op ?? "");
    const fn = String((anyNode as { fn?: unknown }).fn ?? "");
    const operatorKey = fn === "unaryMinus" || fn === "unaryPlus" ? fn : op;
    if (
      !strategy.allowedOperators.has(operatorKey) &&
      !strategy.allowedOperators.has(op)
    ) {
      return { ok: false, error: `Operador no soportado: ${op}` };
    }

    const args = (anyNode as { args?: unknown }).args;
    const argList = Array.isArray(args) ? (args as MathNode[]) : [];
    const isUnary = fn === "unaryMinus" || fn === "unaryPlus";
    const expectedArity = isUnary ? 1 : 2;
    if (argList.length !== expectedArity) {
      return { ok: false, error: "Expresión inválida: aridad incorrecta." };
    }

    for (const child of argList) {
      const result = validateNode({
        node: child,
        variables,
        seen,
        strategy,
      });
      if (!result.ok) return result;
    }

    return { ok: true };
  }

  if ((anyNode as { isParenthesisNode?: boolean }).isParenthesisNode) {
    const content = (anyNode as { content?: MathNode }).content;
    if (!content) {
      return { ok: false, error: "Paréntesis inválidos." };
    }
    return validateNode({
      node: content,
      variables,
      seen,
      strategy,
    });
  }

  if ((anyNode as { isFunctionNode?: boolean }).isFunctionNode) {
    const fn = (anyNode as { fn?: unknown }).fn as
      | (MathNode & { name?: string })
      | undefined;
    const name = typeof fn?.name === "string" ? fn.name : "";
    if (!ALLOWED_FUNCTIONS.has(name)) {
      return { ok: false, error: `Función no soportada: ${name || "?"}` };
    }

    const args = (anyNode as { args?: unknown }).args;
    const argList = Array.isArray(args) ? (args as MathNode[]) : [];
    const rule = ALLOWED_FUNCTIONS.get(name)!;
    const max = rule.max ?? Number.POSITIVE_INFINITY;
    if (argList.length < rule.min || argList.length > max) {
      return { ok: false, error: "Función con número inválido de argumentos." };
    }

    for (const child of argList) {
      const result = validateNode({
        node: child,
        variables,
        seen,
        strategy,
      });
      if (!result.ok) return result;
    }

    return { ok: true };
  }

  if ((anyNode as { isSymbolNode?: boolean }).isSymbolNode) {
    const name = String((anyNode as { name?: unknown }).name ?? "");
    if (!name) {
      return { ok: false, error: "Variable inválida." };
    }
    if (!seen.has(name)) {
      seen.add(name);
      variables.push(name);
    }
    return { ok: true };
  }

  if ((anyNode as { isConstantNode?: boolean }).isConstantNode) {
    const value = (anyNode as { value?: unknown }).value;
    if (typeof value === "boolean") {
      if (strategy.allowBooleanConstants) {
        return { ok: true };
      }
      return {
        ok: false,
        error: "Solo se permiten constantes numéricas en fórmulas aritméticas.",
      };
    }
    if (!isFiniteNumber(value)) {
      return { ok: false, error: "Constante numérica inválida." };
    }
    return { ok: true };
  }

  return { ok: false, error: "Expresión inválida o no soportada." };
}

export function validateFormula(
  formula: string,
  options?: ValidateFormulaOptions,
): FormulaValidationResult {
  const trimmed = formula.trim();
  if (trimmed === "") {
    return { ok: true, variables: [] };
  }

  const mode = options?.mode ?? "logic";
  const strategy = getFormulaStrategy(mode);

  try {
    const node = math.parse(trimmed) as MathNode;
    const variables: string[] = [];
    const seen = new Set<string>();
    const validation = validateNode({
      node,
      variables,
      seen,
      strategy,
    });
    if (!validation.ok) {
      return { ok: false, error: validation.error, variables: [] };
    }

    return { ok: true, variables, compiled: node.compile() };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fórmula inválida.";
    return { ok: false, error: message, variables: [] };
  }
}

export function evaluateFormulaExpression(params: {
  compiled: FormulaCompiled;
  scope: Record<string, number>;
  mode?: FormulaValidationMode;
}): FormulaEvaluateResult {
  const mode = params.mode ?? "arithmetic";
  const strategy = getFormulaStrategy(mode);
  const result = params.compiled.evaluate(params.scope);
  return strategy.evaluateResult(result);
}
