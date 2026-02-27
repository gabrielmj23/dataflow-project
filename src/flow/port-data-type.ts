import { NODE_TYPES } from "@/common/constants";

export type PortDataType = "number" | "text" | "boolean" | "list" | "any";

// Bitmask for validating connections where an input can accept multiple types
// (e.g. concat accepts number OR text).
export type PortDataTypeMask = number;

const TYPE_NUMBER = 1 << 0;
const TYPE_TEXT = 1 << 1;
const TYPE_BOOLEAN = 1 << 2;
const TYPE_LIST = 1 << 3;
const TYPE_ANY = TYPE_NUMBER | TYPE_TEXT | TYPE_BOOLEAN | TYPE_LIST;

export function maskToVisualPortDataType(mask: PortDataTypeMask): PortDataType {
  const safe =
    typeof mask === "number" && Number.isFinite(mask) ? mask : TYPE_ANY;

  const hasNumber = (safe & TYPE_NUMBER) !== 0;
  const hasText = (safe & TYPE_TEXT) !== 0;
  const hasBoolean = (safe & TYPE_BOOLEAN) !== 0;
  const hasList = (safe & TYPE_LIST) !== 0;

  const count =
    Number(hasNumber) + Number(hasText) + Number(hasBoolean) + Number(hasList);
  if (count !== 1) return "any";
  if (hasNumber) return "number";
  if (hasText) return "text";
  if (hasBoolean) return "boolean";
  return "list";
}

export function getHandleShapeClasses(dataType: PortDataType): string {
  // Shape only: do not encode colors here.
  // - number: circle
  // - text: square-ish
  // - boolean: diamond
  // - any: circle (same as number)
  if (dataType === "number") {
    return "rounded-full";
  }
  if (dataType === "text") {
    return "rounded-none";
  }
  if (dataType === "boolean") {
    return "origin-center rotate-45 rounded-none";
  }
  return "rounded-full";
}

export function describePortTypeMask(mask: PortDataTypeMask): string {
  const parts: string[] = [];
  if ((mask & TYPE_NUMBER) !== 0) parts.push("numérico");
  if ((mask & TYPE_TEXT) !== 0) parts.push("texto");
  if ((mask & TYPE_BOOLEAN) !== 0) parts.push("lógico");
  if ((mask & TYPE_LIST) !== 0) parts.push("lista");

  if (parts.length === 0) return "desconocido";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} o ${parts[1]}`;
  return `${parts[0]}, ${parts[1]} o ${parts[2]}`;
}

function toMask(type: PortDataType): PortDataTypeMask {
  switch (type) {
    case "number":
      return TYPE_NUMBER;
    case "text":
      return TYPE_TEXT;
    case "boolean":
      return TYPE_BOOLEAN;
    case "list":
      return TYPE_LIST;
    case "any":
    default:
      return TYPE_ANY;
  }
}

export function portDataTypeToMask(type: PortDataType): PortDataTypeMask {
  return toMask(type);
}

export function normalizePortDataType(value: unknown): PortDataType {
  switch (value) {
    case "number":
    case "text":
    case "boolean":
    case "list":
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
  if (nodeType === "runtimeInput") {
    return "any";
  }
  if (nodeType === "microbitReadButton") {
    return "text";
  }
  if (nodeType === "constantText") {
    return "text";
  }
  if (nodeType === "choiceInput") {
    return "text";
  }
  if (nodeType === "constantList") {
    return "any";
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
    nodeType === "power" ||
    nodeType === "floor" ||
    nodeType === "ceiling" ||
    nodeType === "round" ||
    nodeType === "formulaEditor"
  ) {
    return "number";
  }
  if (nodeType === "concat") {
    return "text";
  }
  if (nodeType === "sliceText" || nodeType === "replaceText" || nodeType === "subtractText") {
    return "text";
  }
  if (nodeType === "replaceText" || nodeType === "subtractText") {
    return "text";
  }
  if (nodeType === "sliceText") {
    return "text";
  }

  // Control & logic
  if (
    nodeType === "and" ||
    nodeType === "nand" ||
    nodeType === "or" ||
    nodeType === "nor" ||
    nodeType === "xor" ||
    nodeType === "not"
  ) {
    return "boolean";
  }
  if (nodeType === "comparison") {
    return handleType === "source" ? "boolean" : "number";
  }
  if (nodeType === "conditional") {
    return handleType === "source" ? "number" : "any";
  }
  if (nodeType === "selector") {
    // Selector passes through the selected value; accept/emit any type.
    return "any";
  }

  // IO
  if (nodeType === "write") {
    return "any";
  }

  // Switch passes through the incoming value.
  if (nodeType === "switch") {
    return "any";
  }

  if (
    nodeType === NODE_TYPES.LIST_FIRST_NODE ||
    nodeType === NODE_TYPES.LIST_LAST_NODE ||
    nodeType === NODE_TYPES.LIST_AT_POSITION_NODE
  ) {
    if (handleType === "target" && nodeType === NODE_TYPES.LIST_AT_POSITION_NODE) {
      return params.handleId === "in-2" ? "number" : "list";
    }
    return handleType === "target" ? "list" : "any";
  }

  if (
    nodeType === NODE_TYPES.LIST_REMOVE_FIRST_NODE ||
    nodeType === NODE_TYPES.LIST_PREPEND_NODE ||
    nodeType === NODE_TYPES.LIST_APPEND_NODE
  ) {
    if (handleType === "target") {
      if (params.handleId === "in-1" || params.handleId === "in") return "list";
      if (params.handleId === "in-2") return "any";
    }
    return "list";
  }

  if (nodeType === NODE_TYPES.LIST_IS_EMPTY_NODE) {
    return handleType === "target" ? "list" : "boolean";
  }

  return "any";
}

/**
 * Returns the allowed type(s) for a given node handle.
 *
 * This is used for connection validation (isValidConnection). It's intentionally
 * broader than runtime typing; if unsure, it should return "any".
 */
export function getPortTypeMask(params: {
  nodeType: string | null | undefined;
  handleType: "source" | "target";
  handleId: string | null | undefined;
}): PortDataTypeMask {
  const { nodeType, handleType, handleId } = params;

  if (!nodeType) return TYPE_ANY;

  const isOutput = handleType === "source";

  // Inputs & events
  if (nodeType === "constantNumber" || nodeType === "randomInput") {
    return isOutput ? TYPE_NUMBER : TYPE_ANY;
  }
  if (nodeType === "runtimeInput") {
    return isOutput ? TYPE_NUMBER | TYPE_TEXT : TYPE_ANY;
  }
  if (nodeType === "microbitReadButton") {
    return isOutput ? TYPE_TEXT : TYPE_ANY;
  }
  if (nodeType === "timerInput") {
    // Timer can optionally pass-through any incoming value after a delay.
    return TYPE_ANY;
  }
  if (nodeType === "constantText") {
    return isOutput ? TYPE_TEXT : TYPE_ANY;
  }
  if (nodeType === "choiceInput") {
    return isOutput ? TYPE_TEXT : TYPE_ANY;
  }
  if (nodeType === "constantList") {
    return TYPE_ANY;
  }
  if (nodeType === "constantBoolean") {
    return isOutput ? TYPE_BOOLEAN : TYPE_ANY;
  }
  if (nodeType === "constantInput") {
    return TYPE_ANY;
  }

  // Processing
  if (
    nodeType === "sum" ||
    nodeType === "subtract" ||
    nodeType === "multiply" ||
    nodeType === "divide" ||
    nodeType === "mod" ||
    nodeType === "power" ||
    nodeType === "floor" ||
    nodeType === "ceiling" ||
    nodeType === "round" ||
    nodeType === "formulaEditor"
  ) {
    return isOutput ? TYPE_NUMBER : TYPE_NUMBER;
  }
  if (nodeType === "concat") {
    // Inputs: number OR text; output is text.
    return isOutput ? TYPE_TEXT : TYPE_NUMBER | TYPE_TEXT;
  }
  if (nodeType === "replaceText" || nodeType === "subtractText") {
    return TYPE_TEXT;
  }
  if (nodeType === "sliceText") {
    if (isOutput) return TYPE_TEXT;
    // in-1 text, in-2 start number, in-3 end number
    if (handleId === "in-1") return TYPE_TEXT;
    if (handleId === "in-2" || handleId === "in-3") return TYPE_NUMBER;
    return TYPE_ANY;
  }

  // Control & logic
  if (
    nodeType === "and" ||
    nodeType === "nand" ||
    nodeType === "or" ||
    nodeType === "nor" ||
    nodeType === "xor" ||
    nodeType === "not"
  ) {
    return TYPE_BOOLEAN;
  }
  if (nodeType === "comparison") {
    // Inputs can be anything; output is boolean.
    return isOutput ? TYPE_BOOLEAN : TYPE_ANY;
  }
  if (nodeType === "conditional") {
    return isOutput ? TYPE_NUMBER : TYPE_ANY;
  }
  if (nodeType === "selector") {
    // Selector inputs and output accept any type (token + routed value).
    return TYPE_ANY;
  }
  if (nodeType === NODE_TYPES.SCATTER_NODE) {
    return isOutput ? TYPE_ANY : TYPE_LIST;
  }
  if (nodeType === "switch") {
    // Switch passes through the incoming value.
    return TYPE_ANY;
  }

  // IO
  if (nodeType === "write") {
    return TYPE_ANY;
  }

  // micro:bit sinks (accept any input for now)
  if (nodeType === "microbitWrite" || nodeType === "microbitSound") {
    return TYPE_ANY;
  }

  // Lists / iteration: keep permissive for now.
  if (
    nodeType === "zip" ||
    nodeType === "filter" ||
    nodeType === "map" ||
    nodeType === "sortList" ||
    nodeType === "accumulate" ||
    nodeType === "count"
  ) {
    return TYPE_ANY;
  }

  if (nodeType === "sequence") {
    // Inputs (Inicio/Fin/Paso) are numbers; output is a list of numbers (kept as any).
    return isOutput ? TYPE_ANY : TYPE_NUMBER;
  }

  if (nodeType === "pulseSequence") {
    // Inputs (Inicio/Fin/Paso) are numbers; output are numeric pulses.
    return isOutput ? TYPE_NUMBER : TYPE_NUMBER;
  }

  if (nodeType === NODE_TYPES.LIST_FIRST_NODE || nodeType === NODE_TYPES.LIST_LAST_NODE) {
    return isOutput ? TYPE_ANY : TYPE_LIST;
  }

  if (nodeType === NODE_TYPES.LIST_AT_POSITION_NODE) {
    if (isOutput) return TYPE_ANY;
    if (handleId === "in-1") return TYPE_LIST;
    if (handleId === "in-2") return TYPE_NUMBER;
    return TYPE_ANY;
  }

  if (nodeType === NODE_TYPES.LIST_REMOVE_FIRST_NODE) {
    return TYPE_LIST;
  }

  if (nodeType === NODE_TYPES.LIST_PREPEND_NODE || nodeType === NODE_TYPES.LIST_APPEND_NODE) {
    if (isOutput) return TYPE_LIST;
    if (handleId === "in-1") return TYPE_LIST;
    if (handleId === "in-2") return TYPE_ANY;
    return TYPE_ANY;
  }

  if (nodeType === NODE_TYPES.LIST_IS_EMPTY_NODE) {
    return isOutput ? TYPE_BOOLEAN : TYPE_LIST;
  }

  return TYPE_ANY;
}

export function isTypeCompatible(params: {
  sourceType: PortDataType | PortDataTypeMask;
  targetType: PortDataType | PortDataTypeMask;
}): boolean {
  const sourceMask =
    typeof params.sourceType === "number"
      ? params.sourceType
      : toMask(params.sourceType);
  const targetMask =
    typeof params.targetType === "number"
      ? params.targetType
      : toMask(params.targetType);
  return (sourceMask & targetMask) !== 0;
}
