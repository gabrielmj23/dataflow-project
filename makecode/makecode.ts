// @ts-nocheck

input.onButtonPressed(Button.A, function () {
  basic.showString("A");
  serial.writeLine("BTN:A");
  bluetooth.uartWriteLine("BTN:A");
});
// Indicador mientras la tarjeta procesa una operación
let operationIndicator = false;
let indicatorRunning = false;

// ------------------------------
// DFP1 protocol (subflows over UART)
// ------------------------------

const DFP1_PREFIX = "DFP1|";
const DFP1_MAX_PROG_BYTES = 2048;
// Keep lines short for micro:bit UART/BLE buffering; hex payload grows fast.
const DFP1_DEFAULT_MAX_CHUNK = 8;
const DFP1_MAX_STR_LEN = 64;
const DFP1_VM_MAX_STACK = 64;

function dfpSendLine(line: string) {
  serial.writeLine(line);
  bluetooth.uartWriteLine(line);
}

function dfpByteToHex(value: number): string {
  const hex = "0123456789abcdef";
  const v = value & 0xff;
  const hi = (v >> 4) & 0x0f;
  const lo = v & 0x0f;
  return hex.charAt(hi) + hex.charAt(lo);
}

function dfpHexFromStringAscii(text: string): string {
  // Best-effort ASCII/latin-1 hex; keeps firmware small.
  // Host can still decode; non-ascii becomes '?'.
  let out = "";
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0 || code > 255) code = 63;
    out += dfpByteToHex(code);
  }
  return out;
}

function dfpHexToBytes(hex: string): number[] {
  const clean = (hex || "").trim();
  const bytes: number[] = [];
  const n = clean.length - (clean.length % 2);
  for (let i = 0; i < n; i += 2) {
    const b = parseInt(clean.substr(i, 2), 16);
    if (isNaN(b)) return [];
    bytes.push(b & 0xff);
  }
  return bytes;
}

function dfpGetField(payloadRaw: string, key: string): string {
  // Avoid split()/arrays to reduce allocations and runtime quirks.
  const txt = (payloadRaw || "").trim();
  if (!txt || !key) return "";
  const needle = key + "=";
  const start = txt.indexOf(needle);
  if (start < 0) return "";
  const valueStart = start + needle.length;
  let end = txt.indexOf(";", valueStart);
  if (end < 0) end = txt.length;
  if (end < valueStart) return "";
  return txt.substr(valueStart, end - valueStart);
}

// CRC32 (IEEE) table-based
let dfpCrcTable: number[] = [];
function dfpInitCrc32() {
  if (dfpCrcTable.length > 0) return;
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      if ((c & 1) != 0) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    dfpCrcTable.push(c >>> 0);
  }
}

function dfpCrc32(bytes: number[]): number {
  dfpInitCrc32();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] & 0xff;
    const idx = (crc ^ b) & 0xff;
    crc = (dfpCrcTable[idx] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// NOTE: Avoid using dynamic objects for payload parsing in MakeCode runtime.
// Some dynamic property access patterns can trigger runtime panics (e.g. 983).

function dfpAck(seq: number, ok: boolean, err?: string, msg?: string) {
  if (ok) {
    dfpSendLine(`${DFP1_PREFIX}ACK|${seq}|OK=1`);
    return;
  }
  const e = (err || "BAD_FORMAT").trim() || "BAD_FORMAT";
  const m = msg ? dfpHexFromStringAscii(msg) : "";
  dfpSendLine(`${DFP1_PREFIX}ACK|${seq}|OK=0;ERR=${e};MSG_HEX=${m}`);
}

function dfpHello(seq: number) {
  // Capabilities are intentionally conservative for the MVP.
  const caps = "ALU,STR,DISPLAY,SOUND,UART,GPIO";
  dfpSendLine(
    `${DFP1_PREFIX}HELLO_RES|${seq}|DEV=MICROBIT;FW=0.1.0;CAPS=${caps};MAX_PROG=${DFP1_MAX_PROG_BYTES};MAX_CHUNK=${DFP1_DEFAULT_MAX_CHUNK}`,
  );
}

// Single in-memory program store (keeps RAM stable and avoids dynamic maps).
let dfpProgId = "";
let dfpProgLen = 0;
let dfpProgCrc32 = 0;
let dfpProgChunk = 0;
let dfpProgCommitted = false;
let dfpProgBytes: number[] = [];
let dfpProgOffs: number[] = [];
let dfpProgHex: string[] = [];
let dfpStopRunId = "";

function dfpHandleDeployBegin(seq: number, payloadRaw: string) {
  // Useful to confirm the device received DEPLOY_BEGIN.
  dfpSendLine(
    `${DFP1_PREFIX}LOG|0|LVL=DEBUG;TXT_HEX=${dfpHexFromStringAscii("DEPLOY_BEGIN")}`,
  );
  const prog = dfpGetField(payloadRaw, "PROG").trim();
  const len = parseInt(dfpGetField(payloadRaw, "LEN") || "0");
  const crc32 = parseInt(dfpGetField(payloadRaw, "CRC32") || "0") >>> 0;
  const chunk = parseInt(dfpGetField(payloadRaw, "CHUNK") || "0");

  if (!prog) {
    dfpAck(seq, false, "BAD_FORMAT", "Missing PROG");
    return;
  }
  if (isNaN(len) || len <= 0 || len > DFP1_MAX_PROG_BYTES) {
    dfpAck(seq, false, "OUT_OF_MEMORY", "Invalid LEN");
    return;
  }
  if (isNaN(chunk) || chunk <= 0 || chunk > DFP1_DEFAULT_MAX_CHUNK) {
    dfpAck(seq, false, "BAD_FORMAT", "Invalid CHUNK");
    return;
  }

  // Reset program state (single program only)
  dfpProgId = prog;
  dfpProgLen = len;
  dfpProgCrc32 = crc32 >>> 0;
  dfpProgChunk = chunk;
  dfpProgCommitted = false;
  dfpProgBytes = [];
  dfpProgOffs = [];
  dfpProgHex = [];
  dfpAck(seq, true);
}

function dfpHandleDeployChunk(seq: number, payloadRaw: string) {
  const prog = dfpGetField(payloadRaw, "PROG").trim();
  const off = parseInt(dfpGetField(payloadRaw, "OFF") || "-1");
  const hex = dfpGetField(payloadRaw, "HEX").trim();

  if (!dfpProgId || prog != dfpProgId) {
    dfpAck(seq, false, "UNKNOWN_PROGRAM", "Unknown PROG");
    return;
  }
  if (dfpProgCommitted) {
    dfpAck(seq, false, "BUSY", "Already committed");
    return;
  }
  if (isNaN(off) || off < 0 || off >= dfpProgLen) {
    dfpAck(seq, false, "BAD_FORMAT", "Invalid OFF");
    return;
  }
  if (!hex || hex.length % 2 != 0) {
    dfpAck(seq, false, "BAD_FORMAT", "Invalid HEX");
    return;
  }

  const bytes = dfpHexToBytes(hex);
  if (bytes.length == 0) {
    dfpAck(seq, false, "BAD_FORMAT", "HEX parse failed");
    return;
  }
  if (bytes.length > dfpProgChunk) {
    dfpAck(seq, false, "BAD_FORMAT", "Chunk too large");
    return;
  }
  if (off + bytes.length > dfpProgLen) {
    dfpAck(seq, false, "BAD_FORMAT", "Chunk overflow");
    return;
  }

  // Upsert by offset (max ~64 chunks for 2048B / 32B).
  let found = -1;
  for (let i = 0; i < dfpProgOffs.length; i++) {
    const existingOff = parseInt("" + dfpProgOffs[i]);
    if (existingOff == off) {
      found = i;
      break;
    }
  }
  if (found >= 0) {
    dfpProgHex[found] = hex;
  } else {
    dfpProgOffs.push(off);
    dfpProgHex.push(hex);
  }
  dfpAck(seq, true);
}

function dfpHandleDeployCommit(seq: number, payloadRaw: string) {
  const prog = dfpGetField(payloadRaw, "PROG").trim();
  if (!dfpProgId || prog != dfpProgId) {
    dfpAck(seq, false, "UNKNOWN_PROGRAM", "Unknown PROG");
    return;
  }
  if (dfpProgCommitted) {
    dfpAck(seq, true);
    return;
  }

  // Optionally accept CRC32 here (keeps DEPLOY_BEGIN shorter for UART/BLE line limits).
  if (dfpProgCrc32 >>> 0 == 0) {
    const crcFromCommit =
      parseInt(dfpGetField(payloadRaw, "CRC32") || "0") >>> 0;
    if (crcFromCommit >>> 0 != 0) dfpProgCrc32 = crcFromCommit >>> 0;
  }

  // Rebuild full byte array
  const bytes: number[] = [];
  for (let i = 0; i < dfpProgLen; i++) bytes.push(0);

  for (let i = 0; i < dfpProgOffs.length; i++) {
    const off = parseInt("" + dfpProgOffs[i]);
    const hex = (dfpProgHex[i] || "").trim();
    if (!hex) continue;
    if (off < 0 || off >= dfpProgLen) continue;
    const chunkBytes = dfpHexToBytes(hex);
    for (let j = 0; j < chunkBytes.length; j++) {
      const idx = off + j;
      bytes[idx] = chunkBytes[j];
    }
  }

  const crc = dfpCrc32(bytes);
  if (dfpProgCrc32 >>> 0 != 0 && crc >>> 0 != dfpProgCrc32 >>> 0) {
    dfpAck(seq, false, "CRC_FAIL", "CRC mismatch");
    return;
  }

  dfpProgCommitted = true;
  dfpProgBytes = bytes;
  // Free chunk hex strings to reduce RAM pressure.
  dfpProgOffs = [];
  dfpProgHex = [];
  dfpAck(seq, true);
}

type DfpValue = {
  tag: number;
  num?: number;
  str?: string;
  bool?: boolean;
  isNull?: boolean;
};

function dfpValueNumber(n: number): DfpValue {
  return { tag: 0, num: n };
}
function dfpValueString(s: string): DfpValue {
  return { tag: 1, str: s };
}
function dfpValueBool(b: boolean): DfpValue {
  return { tag: 2, bool: b };
}
function dfpValueNull(): DfpValue {
  return { tag: 3, isNull: true };
}

function dfpValueToString(v: DfpValue): string {
  if (v.tag == 0) return "" + (v.num || 0);
  if (v.tag == 1) return v.str || "";
  if (v.tag == 2) return v.bool ? "true" : "false";
  return "null";
}

function dfpEncodeValueHex(v: DfpValue): string {
  let bytes: number[] = [];
  if (v.tag == 0) {
    bytes.push(0);
    const buf = control.createBuffer(4);
    buf.setNumber(NumberFormat.Float32LE, 0, v.num || 0);
    for (let i = 0; i < 4; i++) bytes.push(buf[i]);
  } else if (v.tag == 1) {
    bytes.push(1);
    const text = v.str || "";
    const len = text.length & 0xffff;
    bytes.push(len & 0xff);
    bytes.push((len >> 8) & 0xff);
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i);
      if (code < 0 || code > 255) code = 63;
      bytes.push(code & 0xff);
    }
  } else if (v.tag == 2) {
    bytes.push(2);
    bytes.push(v.bool ? 1 : 0);
  } else {
    bytes.push(3);
  }

  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += dfpByteToHex(bytes[i]);
  }
  return hex;
}

function dfpReadU16LE(bytes: number[], off: number): number {
  const lo = bytes[off] & 0xff;
  const hi = bytes[off + 1] & 0xff;
  return (hi << 8) | lo;
}

function dfpReadF32LE(bytes: number[], off: number): number {
  const buf = control.createBuffer(4);
  buf[0] = bytes[off] & 0xff;
  buf[1] = bytes[off + 1] & 0xff;
  buf[2] = bytes[off + 2] & 0xff;
  buf[3] = bytes[off + 3] & 0xff;
  return buf.getNumber(NumberFormat.Float32LE, 0);
}

function dfpDecodeString(bytes: number[], off: number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += String.fromCharCode(bytes[off + i] & 0xff);
  }
  return out;
}

function dfpDecodeValue(
  bytes: number[],
  off: number,
): { value: DfpValue; read: number } {
  const tag = bytes[off] & 0xff;
  if (tag == 0) {
    const num = dfpReadF32LE(bytes, off + 1);
    return { value: dfpValueNumber(num), read: 1 + 4 };
  }
  if (tag == 1) {
    const len = dfpReadU16LE(bytes, off + 1);
    const str = dfpDecodeString(bytes, off + 3, len);
    return { value: dfpValueString(str), read: 1 + 2 + len };
  }
  if (tag == 2) {
    const b = (bytes[off + 1] & 0xff) != 0;
    return { value: dfpValueBool(b), read: 1 + 1 };
  }
  return { value: dfpValueNull(), read: 1 };
}

function dfpDecodeArgsHex(hex: string): DfpValue[] {
  const bytes = dfpHexToBytes(hex);
  if (bytes.length == 0) return [];
  const argc = bytes[0] & 0xff;
  let off = 1;
  const args: DfpValue[] = [];
  for (let i = 0; i < argc; i++) {
    if (off >= bytes.length) break;
    const parsed = dfpDecodeValue(bytes, off);
    args.push(parsed.value);
    off += parsed.read;
  }
  return args;
}

function dfpRequireNumber(v: DfpValue): number {
  if (v.tag == 0) return v.num || 0;
  if (v.tag == 2) return v.bool ? 1 : 0;
  if (v.tag == 1) {
    const n = parseFloat(v.str || "");
    if (!isNaN(n)) return n;
  }
  return 0;
}

function dfpHandleRun(seq: number, payloadRaw: string) {
  const prog = dfpGetField(payloadRaw, "PROG").trim();
  const runId = dfpGetField(payloadRaw, "RUN").trim();
  const argsHex = dfpGetField(payloadRaw, "ARGS_HEX").trim();

  if (!prog) {
    dfpAck(seq, false, "BAD_FORMAT", "Missing PROG");
    return;
  }
  if (
    !dfpProgId ||
    prog != dfpProgId ||
    !dfpProgCommitted ||
    dfpProgBytes.length == 0
  ) {
    dfpAck(seq, false, "UNKNOWN_PROGRAM", "Unknown PROG");
    return;
  }

  const bytes: number[] = dfpProgBytes;
  if (bytes.length < 10) {
    dfpAck(seq, false, "BAD_FORMAT", "Invalid bytecode");
    return;
  }

  // Header
  if (
    !(
      bytes[0] == 0x44 &&
      bytes[1] == 0x46 &&
      bytes[2] == 0x42 &&
      bytes[3] == 0x43
    )
  ) {
    dfpAck(seq, false, "BAD_FORMAT", "Bad magic");
    return;
  }
  const ver = bytes[4] & 0xff;
  if (ver != 1) {
    dfpAck(seq, false, "UNSUPPORTED", "Bad version");
    return;
  }
  const constCount = bytes[6] & 0xff;
  const argCount = bytes[7] & 0xff;
  const instCount = dfpReadU16LE(bytes, 8);

  // Parse const pool
  let off = 10;
  const consts: DfpValue[] = [];
  for (let i = 0; i < constCount; i++) {
    const parsed = dfpDecodeValue(bytes, off);
    consts.push(parsed.value);
    off += parsed.read;
    if (off > bytes.length) {
      dfpAck(seq, false, "BAD_FORMAT", "Const pool overflow");
      return;
    }
  }

  // Parse args
  const args = dfpDecodeArgsHex(argsHex);
  if (args.length < argCount) {
    // still allow execution with missing args as nulls
    while (args.length < argCount) args.push(dfpValueNull());
  }

  dfpAck(seq, true);

  // Execute VM
  let ip = 0;
  const stack: DfpValue[] = [];
  const instBase = off;
  const totalInstBytes = instCount * 4;
  if (instBase + totalInstBytes > bytes.length) {
    dfpSendLine(
      `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=ERROR;TXT_HEX=${dfpHexFromStringAscii("Inst overflow")}`,
    );
    return;
  }

  for (let step = 0; step < instCount; step++) {
    if (dfpStopRunId && runId && dfpStopRunId == runId) {
      dfpStopRunId = "";
      dfpSendLine(
        `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=INFO;TXT_HEX=${dfpHexFromStringAscii("Run stopped")}`,
      );
      return;
    }

    const idx = instBase + ip * 4;
    const op = bytes[idx] & 0xff;
    const a = bytes[idx + 1] & 0xff;
    const b = bytes[idx + 2] & 0xff;
    const c = bytes[idx + 3] & 0xff;
    ip += 1;

    if (op == 0x01) {
      // PUSH_CONST
      if (stack.length >= DFP1_VM_MAX_STACK) {
        dfpSendLine(
          `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=ERROR;TXT_HEX=${dfpHexFromStringAscii("Stack overflow")}`,
        );
        return;
      }
      consts[a] ? stack.push(consts[a]) : stack.push(dfpValueNull());
      continue;
    }
    if (op == 0x02) {
      // LOAD_ARG
      if (stack.length >= DFP1_VM_MAX_STACK) {
        dfpSendLine(
          `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=ERROR;TXT_HEX=${dfpHexFromStringAscii("Stack overflow")}`,
        );
        return;
      }
      args[a] ? stack.push(args[a]) : stack.push(dfpValueNull());
      continue;
    }
    if (
      op == 0x10 ||
      op == 0x11 ||
      op == 0x12 ||
      op == 0x13 ||
      op == 0x14 ||
      op == 0x15 ||
      op == 0x19 ||
      op == 0x1a
    ) {
      const right = stack.pop();
      const left = stack.pop();
      if (!left || !right) {
        stack.push(dfpValueNull());
        continue;
      }
      const x = dfpRequireNumber(left);
      const y = dfpRequireNumber(right);
      let r = 0;
      if (op == 0x10) r = x + y;
      if (op == 0x11) r = x - y;
      if (op == 0x12) r = x * y;
      if (op == 0x13) r = y == 0 ? 0 : x / y;
      if (op == 0x14) r = y == 0 ? 0 : x % y;
      if (op == 0x15) r = Math.pow(x, y);
      if (op == 0x19) {
        const degree = Math.floor(y);
        const validDegree = degree != 0 && degree == y;
        const invalidEvenNegative = x < 0 && Math.abs(degree % 2) != 1;
        r = validDegree && !invalidEvenNegative ? Math.pow(x, 1 / degree) : NaN;
      }
      if (op == 0x1a) {
        const validValue = x > 0;
        const validBase = y > 0 && y != 1;
        r = validValue && validBase ? Math.log(x) / Math.log(y) : NaN;
      }
      stack.push(dfpValueNumber(r));
      continue;
    }
    if (op == 0x16 || op == 0x17 || op == 0x18) {
      const v = stack.pop();
      const x = v ? dfpRequireNumber(v) : 0;
      let r = 0;
      if (op == 0x16) r = Math.floor(x);
      if (op == 0x17) r = Math.ceil(x);
      if (op == 0x18) r = Math.round(x);
      stack.push(dfpValueNumber(r));
      continue;
    }
    if (op == 0x20) {
      // CONCAT
      const right = stack.pop();
      const left = stack.pop();
      let s =
        dfpValueToString(left || dfpValueNull()) +
        dfpValueToString(right || dfpValueNull());
      if (s.length > DFP1_MAX_STR_LEN) s = s.substr(0, DFP1_MAX_STR_LEN);
      if (stack.length >= DFP1_VM_MAX_STACK) {
        dfpSendLine(
          `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=ERROR;TXT_HEX=${dfpHexFromStringAscii("Stack overflow")}`,
        );
        return;
      }
      stack.push(dfpValueString(s));
      continue;
    }
    if (op == 0x30) {
      // DISPLAY_TEXT
      const v = stack.pop();
      const txt = dfpValueToString(v || dfpValueNull());
      // Non-blocking: don't stall the VM / UART processing.
      control.inBackground(function () {
        basic.showString(txt);
      });
      continue;
    }
    if (op == 0x31) {
      // DISPLAY_NUMBER
      const v = stack.pop();
      const num = dfpRequireNumber(v || dfpValueNull());
      control.inBackground(function () {
        basic.showNumber(num);
      });
      continue;
    }
    if (op == 0x32) {
      // PLAY_TONE (pop ms, pop freq)
      const msVal = stack.pop();
      const freqVal = stack.pop();
      const ms = dfpRequireNumber(msVal || dfpValueNumber(250));
      const freq = dfpRequireNumber(freqVal || dfpValueNumber(440));
      control.inBackground(function () {
        if (freq > 0) music.playTone(freq, ms);
      });
      continue;
    }
    if (op == 0x34) {
      stack.push(dfpValueNumber(input.temperature()));
      continue;
    }
    if (op == 0x35) {
      // READ_PIN (pop mode, pop pin)
      const modeRaw = dfpValueToString(
        stack.pop() || dfpValueString("digital"),
      );
      const pinRaw = dfpValueToString(stack.pop() || dfpValueString("P0"));
      const pinMode = normalizePinMode(modeRaw);
      const pinName = normalizePinName(pinRaw);
      const readValue =
        pinMode == "analog"
          ? readAnalogPinByName(pinName)
          : readDigitalPinByName(pinName);
      stack.push(dfpValueNumber(readValue));
      continue;
    }
    if (op == 0x36) {
      // WRITE_PIN (pop mode, pop pin, pop value)
      const modeRaw = dfpValueToString(
        stack.pop() || dfpValueString("digital"),
      );
      const pinRaw = dfpValueToString(stack.pop() || dfpValueString("P0"));
      const valueRaw = stack.pop() || dfpValueNumber(0);
      const pinMode = normalizePinMode(modeRaw);
      const pinName = normalizePinName(pinRaw);
      const value = dfpRequireNumber(valueRaw);
      if (pinMode == "analog") {
        writeAnalogPinByName(pinName, value);
      } else {
        writeDigitalPinByName(pinName, value);
      }
      continue;
    }
    if (op == 0x40) {
      // RETURN
      const v = stack.pop() || dfpValueNull();
      const hex = dfpEncodeValueHex(v);
      dfpSendLine(`${DFP1_PREFIX}RESULT|0|RUN=${runId};VAL_HEX=${hex}`);
      return;
    }

    // Unknown opcode: abort
    dfpSendLine(
      `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=ERROR;TXT_HEX=${dfpHexFromStringAscii("Bad opcode " + op)}`,
    );
    return;
  }

  // No RETURN found
  dfpSendLine(
    `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=ERROR;TXT_HEX=${dfpHexFromStringAscii("No RETURN")}`,
  );
}

function dfpHandleFrame(
  type: string,
  seq: number,
  payloadRaw: string,
): boolean {
  // Returns true if handled as DFP1
  if (type == "HELLO_REQ") {
    dfpHello(seq);
    return true;
  }
  if (type == "PING") {
    dfpSendLine(`${DFP1_PREFIX}PONG|${seq}|`);
    return true;
  }
  if (type == "B" || type == "BEGIN" || type == "DEPLOY_BEGIN") {
    dfpHandleDeployBegin(seq, payloadRaw);
    return true;
  }
  if (type == "C" || type == "CHUNK" || type == "DEPLOY_CHUNK") {
    dfpHandleDeployChunk(seq, payloadRaw);
    return true;
  }
  if (type == "M" || type == "COMMIT" || type == "DEPLOY_COMMIT") {
    dfpHandleDeployCommit(seq, payloadRaw);
    return true;
  }

  // RUN/STOP are parsed, but execution is implemented later.
  if (type == "RUN") {
    dfpHandleRun(seq, payloadRaw);
    return true;
  }
  if (type == "STOP") {
    const runId = dfpGetField(payloadRaw, "RUN").trim();
    if (runId) dfpStopRunId = runId;
    dfpAck(seq, true);
    return true;
  }

  // Unknown DFP1 type
  dfpAck(seq, false, "UNSUPPORTED", "Unknown TYPE");
  return true;
}

function tryHandleDfp1Line(msg: string): boolean {
  const line = (msg || "").trim();
  if (line.indexOf(DFP1_PREFIX) != 0) return false;

  const rest = line.substr(DFP1_PREFIX.length);
  const parts = rest.split("|");
  if (parts.length < 2) {
    // Can't ACK without seq; reply on seq=0
    dfpSendLine(
      `${DFP1_PREFIX}ACK|0|OK=0;ERR=BAD_FORMAT;MSG_HEX=${dfpHexFromStringAscii("Bad header")}`,
    );
    return true;
  }

  const type = (parts[0] || "").trim();
  const seq = parseInt((parts[1] || "").trim());
  const payloadRaw = parts.length >= 3 ? parts.slice(2).join("|") : "";

  if (!type || isNaN(seq)) {
    dfpSendLine(
      `${DFP1_PREFIX}ACK|0|OK=0;ERR=BAD_FORMAT;MSG_HEX=${dfpHexFromStringAscii("Bad type/seq")}`,
    );
    return true;
  }

  return dfpHandleFrame(type, seq, payloadRaw);
}

function startIndicator() {
  if (indicatorRunning) return;
  indicatorRunning = true;
  control.inBackground(function () {
    while (operationIndicator) {
      led.toggle(3, 0);
      led.toggle(4, 0);
      led.toggle(3, 1);
      led.toggle(4, 1);
      basic.pause(300);
    }
    led.unplot(3, 0);
    led.unplot(4, 0);
    led.unplot(3, 1);
    led.unplot(4, 1);
    indicatorRunning = false;
  });
}

function normalizePinName(raw: string): string {
  return (raw || "").trim().toUpperCase();
}

function normalizePinMode(raw: string): string {
  const mode = (raw || "").trim().toLowerCase();
  if (mode == "analog" || mode == "a") return "analog";
  return "digital";
}

function readDigitalPinByName(pin: string): number {
  if (pin == "P16") return pins.digitalReadPin(DigitalPin.P16);
  if (pin == "P15") return pins.digitalReadPin(DigitalPin.P15);
  if (pin == "P14") return pins.digitalReadPin(DigitalPin.P14);
  if (pin == "P13") return pins.digitalReadPin(DigitalPin.P13);
  if (pin == "P12") return pins.digitalReadPin(DigitalPin.P12);
  if (pin == "P11") return pins.digitalReadPin(DigitalPin.P11);
  if (pin == "P10") return pins.digitalReadPin(DigitalPin.P10);
  if (pin == "P9") return pins.digitalReadPin(DigitalPin.P9);
  if (pin == "P8") return pins.digitalReadPin(DigitalPin.P8);
  if (pin == "P7") return pins.digitalReadPin(DigitalPin.P7);
  if (pin == "P6") return pins.digitalReadPin(DigitalPin.P6);
  if (pin == "P5") return pins.digitalReadPin(DigitalPin.P5);
  if (pin == "P1") return pins.digitalReadPin(DigitalPin.P1);
  if (pin == "P2") return pins.digitalReadPin(DigitalPin.P2);
  if (pin == "P3") return pins.digitalReadPin(DigitalPin.P3);
  if (pin == "P4") return pins.digitalReadPin(DigitalPin.P4);
  return pins.digitalReadPin(DigitalPin.P0);
}

function readAnalogPinByName(pin: string): number {
  if (pin == "P1") return pins.analogReadPin(AnalogPin.P1);
  if (pin == "P2") return pins.analogReadPin(AnalogPin.P2);
  if (pin == "P3") return pins.analogReadPin(AnalogPin.P3);
  if (pin == "P4") return pins.analogReadPin(AnalogPin.P4);
  if (pin == "P10") return pins.analogReadPin(AnalogPin.P10);
  return pins.analogReadPin(AnalogPin.P0);
}

function writeDigitalPinByName(pin: string, value: number) {
  let digitalValue = Math.round(value);
  if (digitalValue < 0) digitalValue = 0;
  if (digitalValue > 1) digitalValue = 1;
  if (pin == "P16") {
    pins.digitalWritePin(DigitalPin.P16, digitalValue);
    return;
  }
  if (pin == "P15") {
    pins.digitalWritePin(DigitalPin.P15, digitalValue);
    return;
  }
  if (pin == "P14") {
    pins.digitalWritePin(DigitalPin.P14, digitalValue);
    return;
  }
  if (pin == "P13") {
    pins.digitalWritePin(DigitalPin.P13, digitalValue);
    return;
  }
  if (pin == "P12") {
    pins.digitalWritePin(DigitalPin.P12, digitalValue);
    return;
  }
  if (pin == "P11") {
    pins.digitalWritePin(DigitalPin.P11, digitalValue);
    return;
  }
  if (pin == "P10") {
    pins.digitalWritePin(DigitalPin.P10, digitalValue);
    return;
  }
  if (pin == "P9") {
    pins.digitalWritePin(DigitalPin.P9, digitalValue);
    return;
  }
  if (pin == "P8") {
    pins.digitalWritePin(DigitalPin.P8, digitalValue);
    return;
  }
  if (pin == "P7") {
    pins.digitalWritePin(DigitalPin.P7, digitalValue);
    return;
  }
  if (pin == "P6") {
    pins.digitalWritePin(DigitalPin.P6, digitalValue);
    return;
  }
  if (pin == "P5") {
    pins.digitalWritePin(DigitalPin.P5, digitalValue);
    return;
  }
  if (pin == "P1") {
    pins.digitalWritePin(DigitalPin.P1, digitalValue);
    return;
  }
  if (pin == "P2") {
    pins.digitalWritePin(DigitalPin.P2, digitalValue);
    return;
  }
  if (pin == "P3") {
    pins.digitalWritePin(DigitalPin.P3, digitalValue);
    return;
  }
  if (pin == "P4") {
    pins.digitalWritePin(DigitalPin.P4, digitalValue);
    return;
  }
  pins.digitalWritePin(DigitalPin.P0, digitalValue);
}

function writeAnalogPinByName(pin: string, value: number) {
  let analogValue = Math.round(value);
  if (analogValue < 0) analogValue = 0;
  if (analogValue > 1023) analogValue = 1023;

  if (pin == "P16") {
    pins.analogWritePin(AnalogPin.P16, analogValue);
    return;
  }
  if (pin == "P15") {
    pins.analogWritePin(AnalogPin.P15, analogValue);
    return;
  }
  if (pin == "P14") {
    pins.analogWritePin(AnalogPin.P14, analogValue);
    return;
  }
  if (pin == "P13") {
    pins.analogWritePin(AnalogPin.P13, analogValue);
    return;
  }
  if (pin == "P12") {
    pins.analogWritePin(AnalogPin.P12, analogValue);
    return;
  }
  if (pin == "P11") {
    pins.analogWritePin(AnalogPin.P11, analogValue);
    return;
  }
  if (pin == "P10") {
    pins.analogWritePin(AnalogPin.P10, analogValue);
    return;
  }
  if (pin == "P9") {
    pins.analogWritePin(AnalogPin.P9, analogValue);
    return;
  }
  if (pin == "P8") {
    pins.analogWritePin(AnalogPin.P8, analogValue);
    return;
  }
  if (pin == "P7") {
    pins.analogWritePin(AnalogPin.P7, analogValue);
    return;
  }
  if (pin == "P6") {
    pins.analogWritePin(AnalogPin.P6, analogValue);
    return;
  }
  if (pin == "P5") {
    pins.analogWritePin(AnalogPin.P5, analogValue);
    return;
  }
  if (pin == "P1") {
    pins.analogWritePin(AnalogPin.P1, analogValue);
    return;
  }
  if (pin == "P2") {
    pins.analogWritePin(AnalogPin.P2, analogValue);
    return;
  }
  if (pin == "P3") {
    pins.analogWritePin(AnalogPin.P3, analogValue);
    return;
  }
  if (pin == "P4") {
    pins.analogWritePin(AnalogPin.P4, analogValue);
    return;
  }
  pins.analogWritePin(AnalogPin.P0, analogValue);
}

function handleCommand(msg: string) {
  msg = (msg || "").trim();
  if (!true) {
    return;
  }

  // DFP1 protocol takes precedence over legacy commands.
  if (tryHandleDfp1Line(msg)) {
    return;
  }

  if (msg.indexOf("TXT:") == 0) {
    contenido = msg.substr(4);
    if (contenido.length > 0) {
      basic.showString(contenido);
    }
    return;
  }
  if (msg.indexOf("SUM:") == 0) {
    const payload = msg.substr(4).trim();
    parts = payload.split(",");
    a = parseFloat((parts[0] || "").trim());
    b = parseFloat((parts[1] || "").trim());
    if (!isNaN(a) && !isNaN(b)) {
      sum = a + b;
      operationIndicator = true;
      startIndicator();
      basic.showNumber(sum);
      operationIndicator = false;
      const out = "SUM:" + sum;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
    }
    return;
  }
  if (msg.indexOf("SUB:") == 0) {
    const payload = msg.substr(4).trim();
    parts = payload.split(",");
    a = parseFloat((parts[0] || "").trim());
    b = parseFloat((parts[1] || "").trim());
    if (!isNaN(a) && !isNaN(b)) {
      result = a - b;
      operationIndicator = true;
      startIndicator();
      const out = "SUB:" + result;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("MUL:") == 0) {
    const payload = msg.substr(4).trim();
    parts = payload.split(",");
    a = parseFloat((parts[0] || "").trim());
    b = parseFloat((parts[1] || "").trim());
    if (!isNaN(a) && !isNaN(b)) {
      result = a * b;
      operationIndicator = true;
      startIndicator();
      const out = "MUL:" + result;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("DIV:") == 0) {
    const payload = msg.substr(4).trim();
    parts = payload.split(",");
    a = parseFloat((parts[0] || "").trim());
    b = parseFloat((parts[1] || "").trim());
    if (!isNaN(a) && !isNaN(b)) {
      if (b == 0) {
        result = 0;
      } else {
        result = a / b;
      }
      operationIndicator = true;
      startIndicator();
      const out = "DIV:" + result;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("MOD:") == 0) {
    const payload = msg.substr(4).trim();
    parts = payload.split(",");
    a = parseFloat((parts[0] || "").trim());
    b = parseFloat((parts[1] || "").trim());
    if (!isNaN(a) && !isNaN(b)) {
      if (b == 0) {
        result = 0;
      } else {
        result = a % b;
      }
      operationIndicator = true;
      startIndicator();
      const out = "MOD:" + result;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("POW:") == 0) {
    const payload = msg.substr(4).trim();
    parts = payload.split(",");
    a = parseFloat((parts[0] || "").trim());
    b = parseFloat((parts[1] || "").trim());
    if (!isNaN(a) && !isNaN(b)) {
      result = Math.pow(a, b);
      operationIndicator = true;
      startIndicator();
      const out = "POW:" + result;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("FLOOR:") == 0) {
    const payload = msg.substr(6).trim();
    a = parseFloat(payload);
    if (!isNaN(a)) {
      result = Math.floor(a);
      operationIndicator = true;
      startIndicator();
      const out = "FLOOR:" + result;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("CEIL:") == 0) {
    const payload = msg.substr(5).trim();
    a = parseFloat(payload);
    if (!isNaN(a)) {
      result = Math.ceil(a);
      operationIndicator = true;
      startIndicator();
      const out = "CEIL:" + result;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("ROUND:") == 0) {
    const payload = msg.substr(6).trim();
    a = parseFloat(payload);
    if (!isNaN(a)) {
      result = Math.round(a);
      operationIndicator = true;
      startIndicator();
      const out = "ROUND:" + result;
      serial.writeLine(out);
      bluetooth.uartWriteLine(out);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("CONCAT:") == 0) {
    const payload = msg.substr(7);
    parts = payload.split("|");
    textA = parts[0] || "";
    textB = parts[1] || "";
    operationIndicator = true;
    startIndicator();
    const out = "CONCAT:" + textA + textB;
    serial.writeLine(out);
    bluetooth.uartWriteLine(out);
    operationIndicator = false;
    return;
  }
  if (msg.indexOf("SND:") == 0) {
    const payload = msg.substr(4).trim();
    ms = 250;
    if (payload.indexOf(",") >= 0) {
      parts = payload.split(",");
      freq = parseInt((parts[0] || "").trim());
      d = parseInt((parts[1] || "").trim());
      if (!isNaN(d) && d > 0) {
        ms = d;
      }
    } else {
      freq = parseInt(payload);
    }
    if (!isNaN(freq) && freq > 0) {
      operationIndicator = true;
      startIndicator();
      music.playTone(freq, ms);
      operationIndicator = false;
    }
    return;
  }
  if (msg.indexOf("PINR?:") == 0) {
    const payload = msg.substr(6).trim();
    parts = payload.split(",");
    const pin = normalizePinName(parts.length > 0 ? parts[0] : "P0");
    const mode = normalizePinMode(parts.length > 1 ? parts[1] : "digital");
    const value =
      mode == "analog" ? readAnalogPinByName(pin) : readDigitalPinByName(pin);
    const out = "PINR:" + value;
    serial.writeLine(out);
    bluetooth.uartWriteLine(out);
    return;
  }
  if (msg.indexOf("PINW:") == 0) {
    const payload = msg.substr(5).trim();
    parts = payload.split(",");
    const pin = normalizePinName(parts.length > 0 ? parts[0] : "P0");
    const mode = normalizePinMode(parts.length > 1 ? parts[1] : "digital");
    const rawValue = parseFloat(parts.length > 2 ? parts[2] : "0");
    const value = isNaN(rawValue) ? 0 : rawValue;
    if (mode == "analog") {
      writeAnalogPinByName(pin, value);
    } else {
      writeDigitalPinByName(pin, value);
    }
    return;
  }
}
// --- RECEPCIÓN BLUETOOTH UART
bluetooth.onUartDataReceived(
  serial.delimiters(Delimiters.NewLine),
  function () {
    mensaje = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine));
    handleCommand(mensaje);
  },
);
input.onButtonPressed(Button.B, function () {
  basic.showString("B");
  serial.writeLine("BTN:B");
  bluetooth.uartWriteLine("BTN:B");
});
// --- RECEPCIÓN USB SERIAL
serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
  mensaje = serial.readUntil(serial.delimiters(Delimiters.NewLine));
  handleCommand(mensaje);
});
let mensaje = "";
let d = 0;
let freq = 0;
let parts: string[] = [];
let sum = 0;
let b = 0;
let a = 0;
let result = 0;
let textB = "";
let textA = "";
let ms = 0;
let contenido = "";
bluetooth.startUartService();
// --- SETUP (una sola vez)
serial.redirectToUSB();
serial.setBaudRate(BaudRate.BaudRate115200);
