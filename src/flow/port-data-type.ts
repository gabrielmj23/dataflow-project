export type PortDataType = "number" | "text" | "boolean" | "any";

export function normalizePortDataType(value: unknown): PortDataType {
  switch (value) {
    case "number":
    case "text":
    case "boolean":
    case "any":
      return value;
    default:
      return "any";
  }
}

export function getHandleTypeClasses(params: {
  dataType: PortDataType;
  handleType: "source" | "target";
}): string {
  const { dataType, handleType } = params;

  // Direction mapping:
  // - target (inputs): outlined (bg matches surface)
  // - source (outputs): filled (bg = type color)
  const isOutput = handleType === "source";

  const base = [
    "h-2 w-2 border transition-colors focus:outline-none",
    // Inputs (targets) should be rectangular; outputs stay circular.
    isOutput ? "rounded-full" : "rounded-sm",
  ].join(" ");

  const interaction =
    "hover:ring-2 hover:ring-offset-2 hover:ring-offset-background";

  if (dataType === "number") {
    return [
      base,
      interaction,
      isOutput
        ? "border-sky-700 bg-sky-500 ring-sky-500"
        : "border-sky-700 bg-background ring-sky-500",
    ].join(" ");
  }

  if (dataType === "text") {
    return [
      base,
      interaction,
      isOutput
        ? "border-teal-800 bg-teal-600 ring-teal-600"
        : "border-teal-800 bg-background ring-teal-600",
    ].join(" ");
  }

  if (dataType === "boolean") {
    return [
      base,
      interaction,
      isOutput
        ? "border-emerald-700 bg-emerald-500 ring-emerald-500"
        : "border-emerald-700 bg-background ring-emerald-500",
    ].join(" ");
  }

  return [
    base,
    interaction,
    isOutput
      ? "border-muted-foreground/40 bg-muted ring-muted-foreground/30"
      : "border-muted-foreground/40 bg-background ring-muted-foreground/30",
  ].join(" ");
}

export function getEdgeStrokeClass(dataType: PortDataType): string {
  switch (dataType) {
    case "number":
      return "stroke-sky-600";
    case "text":
      return "stroke-teal-700";
    case "boolean":
      return "stroke-emerald-600";
    default:
      return "stroke-muted-foreground";
  }
}

/**
 * Best-effort mapping for edge coloring based on node type + handle.
 * This is purely visual and does not affect execution/validation.
 */
export function inferPortDataType(params: {
  nodeType: string | null | undefined;
  handleType: "source" | "target";
  handleId: string | null | undefined;
}): PortDataType {
  const { nodeType, handleType } = params;

  if (!nodeType) return "any";

  // Inputs & events
  if (nodeType === "constantNumber" || nodeType === "randomInput") {
    return "number";
  }
  if (nodeType === "constantText") {
    return "text";
  }
  if (nodeType === "constantBoolean") {
    return "boolean";
  }

  // Processing
  if (
    nodeType === "sum" ||
    nodeType === "subtract" ||
    nodeType === "multiply" ||
    nodeType === "divide" ||
    nodeType === "mod" ||
    nodeType === "power"
  ) {
    return "number";
  }
  if (nodeType === "concat") {
    return "text";
  }

  // Control & logic
  if (nodeType === "and" || nodeType === "or" || nodeType === "not") {
    return "boolean";
  }
  if (nodeType === "comparison") {
    return handleType === "source" ? "boolean" : "number";
  }

  // IO
  if (nodeType === "write") {
    return "any";
  }

  // Switch passes through the incoming value.
  if (nodeType === "switch") {
    return "any";
  }

  return "any";
}
