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

const ALLOWED_OPERATORS = new Set(["+", "-", "*", "/", "^"]);

const ALLOWED_FUNCTIONS = new Map<string, { min: number; max?: number }>([
  ["sqrt", { min: 1, max: 1 }],
  ["abs", { min: 1, max: 1 }],
  ["exp", { min: 1, max: 1 }],
  ["log", { min: 1, max: 2 }],
  ["ln", { min: 1, max: 1 }],
  ["pow", { min: 2, max: 2 }],
  ["min", { min: 2 }],
  ["max", { min: 2 }],
  ["round", { min: 1, max: 1 }],
  ["floor", { min: 1, max: 1 }],
  ["ceil", { min: 1, max: 1 }],
  ["sin", { min: 1, max: 1 }],
  ["cos", { min: 1, max: 1 }],
  ["tan", { min: 1, max: 1 }],
  ["asin", { min: 1, max: 1 }],
  ["acos", { min: 1, max: 1 }],
  ["atan", { min: 1, max: 1 }],
]);

function isFiniteNumber(value: unknown): boolean {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num);
}

function validateNode(params: {
  node: MathNode;
  variables: string[];
  seen: Set<string>;
}): { ok: boolean; error?: string } {
  const { node, variables, seen } = params;
  const anyNode = node as MathNode & { [key: string]: unknown };

  if ((anyNode as { isOperatorNode?: boolean }).isOperatorNode) {
    const op = String((anyNode as { op?: unknown }).op ?? "");
    if (!ALLOWED_OPERATORS.has(op)) {
      return { ok: false, error: `Operador no soportado: ${op}` };
    }

    const args = (anyNode as { args?: unknown }).args;
    const argList = Array.isArray(args) ? (args as MathNode[]) : [];
    const expectedArity = op === "unaryMinus" || op === "unaryPlus" ? 1 : 2;
    if (argList.length !== expectedArity) {
      return { ok: false, error: "Expresión inválida: aridad incorrecta." };
    }

    for (const child of argList) {
      const result = validateNode({ node: child, variables, seen });
      if (!result.ok) return result;
    }

    return { ok: true };
  }

  if ((anyNode as { isParenthesisNode?: boolean }).isParenthesisNode) {
    const content = (anyNode as { content?: MathNode }).content;
    if (!content) {
      return { ok: false, error: "Paréntesis inválidos." };
    }
    return validateNode({ node: content, variables, seen });
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
      const result = validateNode({ node: child, variables, seen });
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
    if (!isFiniteNumber(value)) {
      return { ok: false, error: "Constante numérica inválida." };
    }
    return { ok: true };
  }

  return { ok: false, error: "Expresión inválida o no soportada." };
}

export function validateFormula(formula: string): FormulaValidationResult {
  const trimmed = formula.trim();
  if (trimmed === "") {
    return { ok: true, variables: [] };
  }

  try {
    const node = math.parse(trimmed) as MathNode;
    const variables: string[] = [];
    const seen = new Set<string>();
    const validation = validateNode({ node, variables, seen });
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
