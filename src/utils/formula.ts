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

type ValidateFormulaOptions = {
  mode?: FormulaValidationMode;
};

const ALLOWED_ARITHMETIC_OPERATORS = new Set([
  "+",
  "-",
  "unaryPlus",
  "unaryMinus",
  "*",
  "/",
  "^",
]);

const ALLOWED_LOGIC_OPERATORS = new Set([
  ...ALLOWED_ARITHMETIC_OPERATORS,
  ">",
  "<",
  ">=",
  "<=",
  "==",
  "!=",
  "and",
  "or",
]);

export const FORMULA_FUNCTION_GUIDE: FormulaFunctionGuideItem[] = [
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
  FORMULA_FUNCTION_GUIDE.map((fn) => [fn.name, { min: fn.min, max: fn.max }]),
);

export const FORMULA_OPERATOR_GUIDE: FormulaOperatorGuideItem[] = [
  { symbol: "+", labelEs: "Suma" },
  { symbol: "-", labelEs: "Resta" },
  { symbol: "*", labelEs: "Multiplicación" },
  { symbol: "/", labelEs: "División" },
  { symbol: "^", labelEs: "Potencia" },
];

function isFiniteNumber(value: unknown): boolean {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num);
}

function validateNode(params: {
  node: MathNode;
  variables: string[];
  seen: Set<string>;
  allowedOperators: Set<string>;
  allowBooleanConstants: boolean;
}): { ok: boolean; error?: string } {
  const {
    node,
    variables,
    seen,
    allowedOperators,
    allowBooleanConstants,
  } = params;
  const anyNode = node as MathNode & { [key: string]: unknown };

  if ((anyNode as { isOperatorNode?: boolean }).isOperatorNode) {
    const op = String((anyNode as { op?: unknown }).op ?? "");
    if (!allowedOperators.has(op)) {
      return { ok: false, error: `Operador no soportado: ${op}` };
    }

    const args = (anyNode as { args?: unknown }).args;
    const argList = Array.isArray(args) ? (args as MathNode[]) : [];
    const fn = String((anyNode as { fn?: unknown }).fn ?? "");
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
        allowedOperators,
        allowBooleanConstants,
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
      allowedOperators,
      allowBooleanConstants,
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
        allowedOperators,
        allowBooleanConstants,
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
      if (allowBooleanConstants) {
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
  const allowedOperators =
    mode === "arithmetic"
      ? ALLOWED_ARITHMETIC_OPERATORS
      : ALLOWED_LOGIC_OPERATORS;
  const allowBooleanConstants = mode !== "arithmetic";

  try {
    const node = math.parse(trimmed) as MathNode;
    const variables: string[] = [];
    const seen = new Set<string>();
    const validation = validateNode({
      node,
      variables,
      seen,
      allowedOperators,
      allowBooleanConstants,
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
}): number {
  const result = params.compiled.evaluate(params.scope);
  const value = Number(result);
  if (!Number.isFinite(value)) {
    throw new Error("Resultado no válido.");
  }
  return value;
}
