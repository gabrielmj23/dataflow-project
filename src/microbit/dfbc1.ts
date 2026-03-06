import type { Edge, Node } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";

export type DfbcValue =
  | { tag: 0; value: number }
  | { tag: 1; value: string }
  | { tag: 2; value: boolean }
  | { tag: 3 }
  | { tag: 4; value: DfbcValue[] };

export type DfbcCompileParams = {
  nodes: Node[];
  edges: Edge[];
  selectedInputs?: Array<{ nodeId: string; portId: string }>;
  outputSources?: Array<{ nodeId: string; portId: string }>;
};

export type DfbcCompileResult = {
  bytecode: Uint8Array;
  argCount: number;
  constCount: number;
  instructionCount: number;
  outputNodeId?: string;
};

type Instruction = { op: number; a?: number; b?: number; c?: number };

type IncomingMap = Map<string, Map<string, Edge>>;

const OPCODES = {
  PUSH_CONST: 0x01,
  LOAD_ARG: 0x02,
  ADD: 0x10,
  SUB: 0x11,
  MUL: 0x12,
  DIV: 0x13,
  MOD: 0x14,
  POW: 0x15,
  FLOOR: 0x16,
  CEIL: 0x17,
  ROUND: 0x18,
  ROOT: 0x19,
  LOG: 0x1a,
  CONCAT: 0x20,
  REPLACE_TEXT: 0x21,
  SUBTRACT_TEXT: 0x22,
  SLICE_TEXT: 0x23,
  DISPLAY_TEXT: 0x30,
  DISPLAY_NUMBER: 0x31,
  PLAY_TONE: 0x32,
  READ_TEMP: 0x34,
  LIST_COUNT: 0x50,
  LIST_SORT_ASC: 0x51,
  LIST_SORT_DESC: 0x52,
  LIST_ACCUMULATE: 0x53,
  LIST_ZIP: 0x54,
  LIST_UNZIP_A: 0x55,
  LIST_UNZIP_B: 0x56,
  CMP_EQ: 0x60,
  CMP_NEQ: 0x61,
  CMP_LT: 0x62,
  CMP_LTE: 0x63,
  CMP_GT: 0x64,
  CMP_GTE: 0x65,
  LOGIC_AND: 0x70,
  LOGIC_NAND: 0x71,
  LOGIC_OR: 0x72,
  LOGIC_NOR: 0x73,
  LOGIC_XOR: 0x74,
  LOGIC_NOT: 0x75,
  RETURN: 0x40,
} as const;

function stringToLatin1Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    let code = value.charCodeAt(i);
    if (code < 0 || code > 255) code = 63;
    bytes.push(code & 0xff);
  }
  return bytes;
}

function float32ToBytes(value: number): number[] {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, true);
  return [
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  ];
}

function encodeDfbcValueToBytes(value: DfbcValue): number[] {
  if (value.tag === 0) {
    return [0, ...float32ToBytes(value.value)];
  }
  if (value.tag === 1) {
    const bytes = stringToLatin1Bytes(value.value);
    const len = bytes.length & 0xffff;
    return [1, len & 0xff, (len >> 8) & 0xff, ...bytes];
  }
  if (value.tag === 2) {
    return [2, value.value ? 1 : 0];
  }
  if (value.tag === 4) {
    const list = value.value ?? [];
    const safeLen = Math.min(255, list.length);
    const bytes: number[] = [4, safeLen & 0xff];
    for (let i = 0; i < safeLen; i += 1) {
      bytes.push(...encodeDfbcValueToBytes(list[i]));
    }
    return bytes;
  }
  return [3];
}

function toDfbcValue(value: unknown): DfbcValue {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { tag: 0, value };
  }
  if (typeof value === "string") {
    return { tag: 1, value };
  }
  if (typeof value === "boolean") {
    return { tag: 2, value };
  }
  if (Array.isArray(value)) {
    return {
      tag: 4,
      value: value.map((item) => toDfbcValue(item)),
    };
  }
  return { tag: 3 };
}

function mapOutputHandleFromPort(params: {
  nodeType: string;
  portId?: string | null;
}): string | null {
  const portId = params.portId ?? null;
  if (!portId) return null;

  if (params.nodeType === NODE_TYPES.UNZIP_NODE) {
    if (portId === "listA") return "out-1";
    if (portId === "listB") return "out-2";
    return null;
  }

  if (portId === "output" || portId === "outputList") {
    return "out";
  }

  return null;
}

function buildIncomingMap(edges: Edge[]): IncomingMap {
  const map: IncomingMap = new Map();
  for (const edge of edges) {
    const targetId = String(edge.target);
    const handle = edge.targetHandle ?? "";
    if (!map.has(targetId)) {
      map.set(targetId, new Map());
    }
    map.get(targetId)!.set(handle, edge);
  }
  return map;
}

function getEdgeForHandle(
  incoming: IncomingMap,
  nodeId: string,
  handleId: string,
): Edge | null {
  const map = incoming.get(nodeId);
  if (!map) return null;
  return map.get(handleId) ?? null;
}

function pickOutputTarget(
  nodes: Node[],
  outputSources?: Array<{ nodeId: string; portId: string }>,
): {
  nodeId: string;
  portId?: string | null;
  kind: "subflowOutput" | "node";
} | null {
  const outputs = nodes
    .filter((n) => String(n.type) === NODE_TYPES.SUBFLOW_OUTPUT)
    .slice()
    .sort((a, b) => {
      const ay = (a.position?.y ?? 0) as number;
      const by = (b.position?.y ?? 0) as number;
      if (ay !== by) return ay - by;
      const ax = (a.position?.x ?? 0) as number;
      const bx = (b.position?.x ?? 0) as number;
      return ax - bx;
    });

  if (outputs.length > 0) {
    return { nodeId: String(outputs[0].id), kind: "subflowOutput" };
  }

  if (outputSources && outputSources.length > 0) {
    return {
      nodeId: String(outputSources[0].nodeId),
      portId: outputSources[0].portId ?? null,
      kind: "node",
    };
  }

  return null;
}

export function compileSubflowToDfbc1(
  params: DfbcCompileParams,
): DfbcCompileResult {
  const nodeById = new Map<string, Node>();
  for (const node of params.nodes) {
    nodeById.set(String(node.id), node);
  }

  const incoming = buildIncomingMap(params.edges);
  const selectedInputs = params.selectedInputs ?? [];
  const argIndexByNodeId = new Map<string, number>();
  selectedInputs.forEach((entry, index) => {
    argIndexByNodeId.set(String(entry.nodeId), index);
  });

  const instructions: Instruction[] = [];
  const consts: DfbcValue[] = [];
  const constIndexByKey = new Map<string, number>();

  function getConstIndex(value: DfbcValue): number {
    const key =
      value.tag === 0
        ? `n:${value.value}`
        : value.tag === 1
          ? `s:${value.value}`
          : value.tag === 2
            ? `b:${value.value ? "1" : "0"}`
            : "null";

    const existing = constIndexByKey.get(key);
    if (existing != null) return existing;
    consts.push(value);
    constIndexByKey.set(key, consts.length - 1);
    return consts.length - 1;
  }

  function emit(op: number, a = 0, b = 0, c = 0) {
    instructions.push({ op, a, b, c });
  }

  function pushConst(value: DfbcValue) {
    const idx = getConstIndex(value);
    emit(OPCODES.PUSH_CONST, idx);
  }

  const visiting = new Set<string>();

  function compileInputForNode(nodeId: string, handleId: string) {
    const edge = getEdgeForHandle(incoming, nodeId, handleId);
    if (!edge) {
      pushConst({ tag: 3 });
      return;
    }
    compileValueFromNode(String(edge.source), edge.sourceHandle ?? null);
  }

  function compileValueFromNode(
    nodeId: string,
    outputHandleId?: string | null,
    outputPortId?: string | null,
  ) {
    if (visiting.has(nodeId)) {
      throw new Error(
        "El subflujo contiene un ciclo o referencias recursivas.",
      );
    }

    const node = nodeById.get(nodeId);
    if (!node) {
      pushConst({ tag: 3 });
      return;
    }

    visiting.add(nodeId);
    const type = String(node.type);
    const data = (node.data ?? {}) as Record<string, unknown>;
    const resolvedOutputHandle =
      outputHandleId ??
      mapOutputHandleFromPort({
        nodeType: type,
        portId: outputPortId ?? null,
      });

    switch (type) {
      case NODE_TYPES.SUBFLOW_INPUT:
      case NODE_TYPES.FILTER_INPUT_VALUE:
      case NODE_TYPES.MAP_INPUT_VALUE: {
        const argIndex = argIndexByNodeId.get(nodeId);
        if (argIndex == null) {
          pushConst({ tag: 3 });
        } else {
          emit(OPCODES.LOAD_ARG, argIndex);
        }
        break;
      }
      case NODE_TYPES.SUBFLOW_OUTPUT: {
        compileInputForNode(nodeId, "value");
        break;
      }
      case NODE_TYPES.CONSTANT_NUMBER_INPUT: {
        const value = typeof data.value === "number" ? data.value : 0;
        pushConst({ tag: 0, value });
        break;
      }
      case NODE_TYPES.CONSTANT_TEXT_INPUT: {
        const value = typeof data.value === "string" ? data.value : "";
        pushConst({ tag: 1, value });
        break;
      }
      case NODE_TYPES.CONSTANT_BOOLEAN_INPUT: {
        const value = data.value !== false;
        pushConst({ tag: 2, value });
        break;
      }
      case NODE_TYPES.CONSTANT_LIST_INPUT: {
        const items = Array.isArray(data.items) ? data.items : [];
        pushConst({ tag: 4, value: items.map((item) => toDfbcValue(item)) });
        break;
      }
      case NODE_TYPES.CONSTANT_INPUT: {
        const raw = data.value;
        pushConst(toDfbcValue(raw));
        break;
      }
      case NODE_TYPES.SUM_NODE:
      case NODE_TYPES.SUBTRACT_NODE:
      case NODE_TYPES.MULTIPLY_NODE:
      case NODE_TYPES.DIVIDE_NODE:
      case NODE_TYPES.MOD_NODE:
      case NODE_TYPES.POWER_NODE:
      case NODE_TYPES.ROOT_NODE:
      case NODE_TYPES.LOGARITHM_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        const op =
          type === NODE_TYPES.SUM_NODE
            ? OPCODES.ADD
            : type === NODE_TYPES.SUBTRACT_NODE
              ? OPCODES.SUB
              : type === NODE_TYPES.MULTIPLY_NODE
                ? OPCODES.MUL
                : type === NODE_TYPES.DIVIDE_NODE
                  ? OPCODES.DIV
                  : type === NODE_TYPES.MOD_NODE
                    ? OPCODES.MOD
                    : type === NODE_TYPES.POWER_NODE
                      ? OPCODES.POW
                      : type === NODE_TYPES.ROOT_NODE
                        ? OPCODES.ROOT
                        : OPCODES.LOG;
        emit(op);
        break;
      }
      case NODE_TYPES.FLOOR_NODE:
      case NODE_TYPES.CEILING_NODE:
      case NODE_TYPES.ROUND_NODE: {
        compileInputForNode(nodeId, "in-1");
        const op =
          type === NODE_TYPES.FLOOR_NODE
            ? OPCODES.FLOOR
            : type === NODE_TYPES.CEILING_NODE
              ? OPCODES.CEIL
              : OPCODES.ROUND;
        emit(op);
        break;
      }
      case NODE_TYPES.CONCAT_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(OPCODES.CONCAT);
        break;
      }
      case NODE_TYPES.REPLACE_TEXT_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        compileInputForNode(nodeId, "in-3");
        emit(OPCODES.REPLACE_TEXT);
        break;
      }
      case NODE_TYPES.SUBTRACT_TEXT_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(OPCODES.SUBTRACT_TEXT);
        break;
      }
      case NODE_TYPES.SLICE_TEXT_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        compileInputForNode(nodeId, "in-3");
        emit(OPCODES.SLICE_TEXT);
        break;
      }
      case NODE_TYPES.ZIP_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(OPCODES.LIST_ZIP);
        break;
      }
      case NODE_TYPES.COMPARISON_NODE: {
        const operator = data.operator;
        const op =
          operator === "!="
            ? OPCODES.CMP_NEQ
            : operator === "<"
              ? OPCODES.CMP_LT
              : operator === "<="
                ? OPCODES.CMP_LTE
                : operator === ">"
                  ? OPCODES.CMP_GT
                  : operator === ">="
                    ? OPCODES.CMP_GTE
                    : OPCODES.CMP_EQ;
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(op);
        break;
      }
      case NODE_TYPES.AND_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(OPCODES.LOGIC_AND);
        break;
      }
      case NODE_TYPES.NAND_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(OPCODES.LOGIC_NAND);
        break;
      }
      case NODE_TYPES.OR_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(OPCODES.LOGIC_OR);
        break;
      }
      case NODE_TYPES.NOR_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(OPCODES.LOGIC_NOR);
        break;
      }
      case NODE_TYPES.XOR_NODE: {
        compileInputForNode(nodeId, "in-1");
        compileInputForNode(nodeId, "in-2");
        emit(OPCODES.LOGIC_XOR);
        break;
      }
      case NODE_TYPES.NOT_NODE: {
        compileInputForNode(nodeId, "in");
        emit(OPCODES.LOGIC_NOT);
        break;
      }
      case NODE_TYPES.UNZIP_NODE: {
        compileInputForNode(nodeId, "in");
        const handle = resolvedOutputHandle;
        emit(handle === "out-2" ? OPCODES.LIST_UNZIP_B : OPCODES.LIST_UNZIP_A);
        break;
      }
      case NODE_TYPES.COUNT_NODE: {
        compileInputForNode(nodeId, "in");
        emit(OPCODES.LIST_COUNT);
        break;
      }
      case NODE_TYPES.SORT_LIST_NODE: {
        compileInputForNode(nodeId, "in");
        const order = data.order === "desc" ? "desc" : "asc";
        emit(order === "desc" ? OPCODES.LIST_SORT_DESC : OPCODES.LIST_SORT_ASC);
        break;
      }
      case NODE_TYPES.REDUCE_NODE: {
        compileInputForNode(nodeId, "in");
        emit(OPCODES.LIST_ACCUMULATE);
        break;
      }
      case NODE_TYPES.MICROBIT_WRITE: {
        compileInputForNode(nodeId, "in-1");
        emit(OPCODES.DISPLAY_TEXT);
        pushConst({ tag: 3 });
        break;
      }
      case NODE_TYPES.MICROBIT_SOUND: {
        compileInputForNode(nodeId, "in-1");
        // ms defaults to 250 if no in-2
        const edge = getEdgeForHandle(incoming, nodeId, "in-2");
        if (edge) {
          compileValueFromNode(String(edge.source));
        } else {
          pushConst({ tag: 0, value: 250 });
        }
        emit(OPCODES.PLAY_TONE);
        pushConst({ tag: 3 });
        break;
      }
      case NODE_TYPES.MICROBIT_READ_TEMPERATURE_INPUT: {
        emit(OPCODES.READ_TEMP);
        break;
      }
      default:
        throw new Error(`Nodo no soportado para micro:bit: ${type}`);
    }

    visiting.delete(nodeId);
  }

  const outputTarget = pickOutputTarget(params.nodes, params.outputSources);
  if (outputTarget) {
    if (outputTarget.kind === "subflowOutput") {
      compileInputForNode(outputTarget.nodeId, "value");
    } else {
      compileValueFromNode(
        outputTarget.nodeId,
        null,
        outputTarget.portId ?? null,
      );
    }
  } else {
    pushConst({ tag: 3 });
  }
  emit(OPCODES.RETURN);

  const byteParts: number[] = [];
  byteParts.push(0x44, 0x46, 0x42, 0x43); // DFBC
  byteParts.push(1); // version
  byteParts.push(0); // flags
  byteParts.push(consts.length & 0xff); // constCount
  byteParts.push(selectedInputs.length & 0xff); // argCount

  const instCount = instructions.length;
  byteParts.push(instCount & 0xff, (instCount >> 8) & 0xff); // instCount u16

  for (const c of consts) {
    if (c.tag === 0) {
      byteParts.push(0);
      byteParts.push(...float32ToBytes(c.value));
    } else if (c.tag === 1) {
      const bytes = stringToLatin1Bytes(c.value);
      const len = bytes.length & 0xffff;
      byteParts.push(1, len & 0xff, (len >> 8) & 0xff, ...bytes);
    } else if (c.tag === 2) {
      byteParts.push(2, c.value ? 1 : 0);
    } else if (c.tag === 4) {
      const list = c.value ?? [];
      const safeLen = Math.min(255, list.length);
      byteParts.push(4, safeLen & 0xff);
      for (let i = 0; i < safeLen; i += 1) {
        byteParts.push(...encodeDfbcValueToBytes(list[i]));
      }
    } else {
      byteParts.push(3);
    }
  }

  for (const inst of instructions) {
    byteParts.push(inst.op & 0xff, inst.a ?? 0, inst.b ?? 0, inst.c ?? 0);
  }

  return {
    bytecode: Uint8Array.from(byteParts),
    argCount: selectedInputs.length,
    constCount: consts.length,
    instructionCount: instructions.length,
    outputNodeId: outputTarget?.nodeId,
  };
}

export function encodeValueToBytes(value: unknown): number[] {
  return encodeDfbcValueToBytes(toDfbcValue(value));
}

export function encodeArgsHex(args: unknown[]): string {
  const bytes: number[] = [];
  bytes.push(Math.min(255, args.length) & 0xff);
  for (let i = 0; i < args.length && i < 255; i += 1) {
    bytes.push(...encodeValueToBytes(args[i]));
  }

  let hex = "";
  for (const b of bytes) {
    const h = b.toString(16).padStart(2, "0");
    hex += h;
  }
  return hex;
}

function decodeValueFromBytes(
  bytes: number[],
  start: number,
): { value: unknown; next: number } {
  if (start >= bytes.length) {
    return { value: null, next: start };
  }

  const tag = bytes[start];
  if (tag === 0 && start + 4 < bytes.length) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint8(0, bytes[start + 1]);
    view.setUint8(1, bytes[start + 2]);
    view.setUint8(2, bytes[start + 3]);
    view.setUint8(3, bytes[start + 4]);
    return { value: view.getFloat32(0, true), next: start + 5 };
  }
  if (tag === 1 && start + 2 < bytes.length) {
    const len = bytes[start + 1] | (bytes[start + 2] << 8);
    const slice = bytes.slice(start + 3, start + 3 + len);
    return { value: String.fromCharCode(...slice), next: start + 3 + len };
  }
  if (tag === 2 && start + 1 < bytes.length) {
    return { value: bytes[start + 1] !== 0, next: start + 2 };
  }
  if (tag === 4 && start + 1 < bytes.length) {
    const len = bytes[start + 1];
    const items: unknown[] = [];
    let idx = start + 2;
    for (let i = 0; i < len && idx < bytes.length; i += 1) {
      const decoded = decodeValueFromBytes(bytes, idx);
      items.push(decoded.value);
      idx = decoded.next;
    }
    return { value: items, next: idx };
  }

  return { value: null, next: start + 1 };
}

export function decodeValueHex(hex: string): unknown {
  const bytes: number[] = [];
  const clean = (hex ?? "").trim();
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (!Number.isFinite(byte)) break;
    bytes.push(byte & 0xff);
  }
  if (bytes.length === 0) return null;
  return decodeValueFromBytes(bytes, 0).value;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    let c = (crc ^ bytes[i]) & 0xff;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}
