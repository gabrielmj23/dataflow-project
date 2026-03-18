//@ts-nocheck

// Configuración de Hardware
serial.redirectToUSB();
serial.setBaudRate(BaudRate.BaudRate115200);
bluetooth.startUartService();

input.onButtonPressed(Button.A, function () {
  serial.writeLine("BTN:A");
  bluetooth.uartWriteLine("BTN:A");
});

input.onButtonPressed(Button.B, function () {
  serial.writeLine("BTN:B");
  bluetooth.uartWriteLine("BTN:B");
});

input.onButtonPressed(Button.AB, function () {
  serial.writeLine("BTN:AB");
  bluetooth.uartWriteLine("BTN:AB");
});

// ==========================================
// CONSTANTES Y CONFIGURACIÓN
// ==========================================
const DFP1_PREFIX = "DFP1|";
const DFP1_MAX_PROG_BYTES = 4096;
const DFP1_VM_MAX_STACK = 64;
const DFP1_MAX_STR_LEN = 128;

// Buffers globales para el programa
let dfpProgBuffer: Buffer = control.createBuffer(DFP1_MAX_PROG_BYTES);
let dfpProgId = "";
let dfpProgLen = 0;
let dfpProgCrc32 = 0;
let dfpProgCommitted = false;
let dfpStopRunId = "";
let dfpMaxWritten = 0;

// Compact RUN args buffering (for very small line limits)
let dfpArgsRunId = "";
let dfpArgsHex = "";

// Indicadores visuales
let isProcessing = false;

// ==========================================
// UTILIDADES: HEX Y CRC
// ==========================================

function dfpSendLine(line: string) {
  serial.writeLine(line);
  bluetooth.uartWriteLine(line);
}

function dfpByteToHex(value: number): string {
  const hex = "0123456789abcdef";
  return hex.charAt((value >> 4) & 0xf) + hex.charAt(value & 0xf);
}

function dfpHexToBytesToBuffer(
  hex: string,
  targetBuf: Buffer,
  offset: number,
): number {
  // Escribe hex directamente en el buffer.
  // Robustez: filtra a caracteres hex (0-9a-fA-F) y tolera longitudes impares
  // (se descarta el último nibble).
  const raw = (hex || "").trim();
  let clean = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charAt(i);
    const code = raw.charCodeAt(i);
    const is09 = code >= 48 && code <= 57;
    const isAF = code >= 65 && code <= 70;
    const isaf = code >= 97 && code <= 102;
    if (is09 || isAF || isaf) clean += c;
  }
  let len = clean.length;
  if (len < 2) return 0;
  if (len % 2 != 0) {
    clean = clean.substr(0, len - 1);
    len = clean.length;
    if (len < 2) return 0;
  }
  let count = 0;
  for (let i = 0; i < len; i += 2) {
    const val = parseInt(clean.substr(i, 2), 16);
    if (isNaN(val)) return 0;
    targetBuf[offset + count] = val & 0xff;
    count++;
  }
  return count;
}

function dfpHexFromString(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += dfpByteToHex(text.charCodeAt(i) & 0xff);
  }
  return out;
}

// CRC32 IEEE estándar
let crcTable: number[] = [];
function initCrc() {
  if (crcTable.length > 0) return;
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable.push(c >>> 0);
  }
}

function calcBufferCrc32(buf: Buffer, length: number): number {
  initCrc();
  let crc = 0xffffffff;
  for (let i = 0; i < length; i++) {
    const idx = (crc ^ buf[i]) & 0xff;
    crc = (crcTable[idx] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dfpGetField(payload: string, key: string): string {
  const i = payload.indexOf(key + "=");
  if (i < 0) return "";
  let end = payload.indexOf(";", i);
  if (end < 0) end = payload.length;
  return payload.substr(i + key.length + 1, end - (i + key.length + 1));
}

function dfpParseDec(raw: string): number {
  const s = (raw || "").trim();
  if (!s) return NaN;
  return parseInt(s, 10);
}

function dfpParseBase36(raw: string): number {
  const s = (raw || "").trim();
  if (!s) return NaN;
  return parseInt(s, 36);
}

function dfpHexToBuffer(hex: string): Buffer {
  const raw = (hex || "").trim();
  let clean = "";
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    const is09 = code >= 48 && code <= 57;
    const isAF = code >= 65 && code <= 70;
    const isaf = code >= 97 && code <= 102;
    if (is09 || isAF || isaf) clean += raw.charAt(i);
  }
  if (clean.length % 2 != 0) clean = clean.substr(0, clean.length - 1);
  const n = clean.length / 2;
  const buf = control.createBuffer(n);
  for (let i = 0; i < n; i++) {
    const val = parseInt(clean.substr(i * 2, 2), 16);
    buf[i] = (isNaN(val) ? 0 : val) & 0xff;
  }
  return buf;
}

function dfpAck(seq: number, ok: boolean, err: string = "", msg: string = "") {
  if (ok) {
    dfpSendLine(`${DFP1_PREFIX}ACK|${seq}|OK=1`);
  } else {
    const hexMsg = dfpHexFromString(msg);
    dfpSendLine(`${DFP1_PREFIX}ACK|${seq}|OK=0;ERR=${err};MSG_HEX=${hexMsg}`);
  }
}

// ==========================================
// MÁQUINA VIRTUAL
// ==========================================

// Tipos de valores para la pila
enum DfpType {
  Number = 0,
  String = 1,
  Bool = 2,
  Null = 3,
  List = 4,
}
class DfpVal {
  tag: DfpType;
  num: number;
  str: string;
  bool: boolean;
  list: DfpVal[];
  constructor(t: DfpType) {
    this.tag = t;
    this.num = 0;
    this.str = "";
    this.bool = false;
    this.list = [];
  }
}

// Helpers de Valores
function valNum(n: number): DfpVal {
  let v = new DfpVal(DfpType.Number);
  v.num = n;
  return v;
}
function valStr(s: string): DfpVal {
  let v = new DfpVal(DfpType.String);
  v.str = s;
  return v;
}
function valBool(b: boolean): DfpVal {
  let v = new DfpVal(DfpType.Bool);
  v.bool = b;
  return v;
}
function valNull(): DfpVal {
  return new DfpVal(DfpType.Null);
}
function valList(items: DfpVal[]): DfpVal {
  let v = new DfpVal(DfpType.List);
  v.list = items;
  return v;
}

function valToString(v: DfpVal): string {
  if (v.tag == DfpType.Number) return "" + v.num;
  if (v.tag == DfpType.String) return v.str;
  if (v.tag == DfpType.Bool) return v.bool ? "true" : "false";
  if (v.tag == DfpType.List) {
    let out = "[";
    for (let i = 0; i < v.list.length; i++) {
      if (i > 0) out += ",";
      out += valToString(v.list[i]);
    }
    return out + "]";
  }
  return "null";
}

function valTruthy(v: DfpVal): boolean {
  if (v.tag == DfpType.Bool) return v.bool;
  if (v.tag == DfpType.Number) return v.num != 0;
  if (v.tag == DfpType.String) return v.str.length > 0;
  if (v.tag == DfpType.List) return v.list.length > 0;
  return false;
}

function valToNumber(v: DfpVal): number {
  if (v.tag == DfpType.Number) return v.num;
  if (v.tag == DfpType.Bool) return v.bool ? 1 : 0;
  if (v.tag == DfpType.String) {
    const n = parseFloat(v.str);
    return isNaN(n) ? 0 : n;
  }
  if (v.tag == DfpType.List) return v.list.length;
  return 0;
}

function valEquals(a: DfpVal, b: DfpVal): boolean {
  if (a.tag != b.tag) return false;
  if (a.tag == DfpType.Number) return a.num == b.num;
  if (a.tag == DfpType.String) return a.str == b.str;
  if (a.tag == DfpType.Bool) return a.bool == b.bool;
  if (a.tag == DfpType.Null) return true;
  if (a.tag == DfpType.List) {
    if (a.list.length != b.list.length) return false;
    for (let i = 0; i < a.list.length; i++) {
      if (!valEquals(a.list[i], b.list[i])) return false;
    }
    return true;
  }
  return false;
}

function valEncodeHex(v: DfpVal): string {
  if (v.tag == DfpType.Number) {
    const b = control.createBuffer(4);
    b.setNumber(NumberFormat.Float32LE, 0, v.num);
    return "00" + b.toHex();
  } else if (v.tag == DfpType.String) {
    const s = v.str;
    const len = s.length;
    // 01 + Len(2 bytes) + String
    const lenHex = dfpByteToHex(len & 0xff) + dfpByteToHex((len >> 8) & 0xff);
    return "01" + lenHex + dfpHexFromString(s);
  } else if (v.tag == DfpType.Bool) {
    return "02" + (v.bool ? "01" : "00");
  } else if (v.tag == DfpType.List) {
    const items = v.list || [];
    const safeLen = Math.min(255, items.length);
    let out = "04" + dfpByteToHex(safeLen & 0xff);
    for (let i = 0; i < safeLen; i++) {
      out += valEncodeHex(items[i]);
    }
    return out;
  }
  return "03";
}

// Decodifica argumentos entrantes en HEX
function decodeValueFromBuffer(
  buf: Buffer,
  offset: number,
): { value: DfpVal; next: number } {
  if (offset >= buf.length) {
    return { value: valNull(), next: offset };
  }

  const tag = buf[offset++];
  if (tag == DfpType.Number) {
    if (offset + 3 >= buf.length) return { value: valNull(), next: offset };
    const n = buf.getNumber(NumberFormat.Float32LE, offset);
    return { value: valNum(n), next: offset + 4 };
  }

  if (tag == DfpType.String) {
    if (offset + 1 >= buf.length) return { value: valNull(), next: offset };
    const len = buf.getNumber(NumberFormat.UInt16LE, offset);
    offset += 2;
    const s = buf.slice(offset, len).toString();
    return { value: valStr(s), next: offset + len };
  }

  if (tag == DfpType.Bool) {
    if (offset >= buf.length) return { value: valNull(), next: offset };
    const b = buf[offset++] != 0;
    return { value: valBool(b), next: offset };
  }

  if (tag == DfpType.List) {
    if (offset >= buf.length) return { value: valList([]), next: offset };
    const len = buf[offset++];
    const items: DfpVal[] = [];
    let off = offset;
    for (let i = 0; i < len && off < buf.length; i++) {
      const decoded = decodeValueFromBuffer(buf, off);
      items.push(decoded.value);
      off = decoded.next;
    }
    return { value: valList(items), next: off };
  }

  return { value: valNull(), next: offset };
}

function decodeArgs(hex: string): DfpVal[] {
  const args: DfpVal[] = [];
  const buf = dfpHexToBuffer(hex);
  let off = 0;
  if (buf.length == 0) return args;

  // El primer byte es la cantidad de argumentos
  const argc = buf[off++];

  for (let i = 0; i < argc && off < buf.length; i++) {
    const decoded = decodeValueFromBuffer(buf, off);
    args.push(decoded.value);
    off = decoded.next;
  }
  return args;
}

function executeVm(runId: string, args: DfpVal[]) {
  control.inBackground(() => {
    isProcessing = true;

    // 1. Validar Header
    const magic = dfpProgBuffer.getNumber(NumberFormat.UInt32LE, 0);
    // 0x44464243 = DFBC
    if (magic != 0x43424644) {
      dfpSendLine(
        `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=ERROR;TXT_HEX=${dfpHexFromString("Bad Magic")}`,
      );
      isProcessing = false;
      return;
    }

    const constCount = dfpProgBuffer[6];
    const argCount = dfpProgBuffer[7];
    const instCount = dfpProgBuffer.getNumber(NumberFormat.UInt16LE, 8);

    // 2. Cargar Constantes
    let offset = 10;
    const constPool: DfpVal[] = [];

    for (let i = 0; i < constCount; i++) {
      const decoded = decodeValueFromBuffer(dfpProgBuffer, offset);
      constPool.push(decoded.value);
      offset = decoded.next;
    }

    // 3. Preparar Pila
    const stack: DfpVal[] = [];
    // Pushear argumentos (si faltan se rellenan con null)
    for (let i = 0; i < argCount; i++) {
      if (i < args.length) stack.push(args[i]);
      else stack.push(valNull());
    }

    // 4. Ciclo de ejecución
    let pc = 0;
    const instBase = offset;

    while (pc < instCount) {
      // Verificar parada forzada
      if (dfpStopRunId == runId) {
        dfpSendLine(
          `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=INFO;TXT_HEX=${dfpHexFromString("Stopped")}`,
        );
        break;
      }

      // Fetch opcodes (4 bytes fijos)
      const addr = instBase + pc * 4;
      const op = dfpProgBuffer[addr];
      const a = dfpProgBuffer[addr + 1];
      // b y c reservados por ahora

      pc++;

      // Dispatcher
      switch (op) {
        case 0x01: // PUSH_CONST
          stack.push(constPool[a] || valNull());
          break;
        case 0x02: // LOAD_ARG (Ya están en stack al inicio, pero si fuera necesario acceso aleatorio se implementaría aquí)
          // En stack machine puro, args se pushean al inicio.
          // Si tu compilador usa carga posicional, usa esto:
          if (a < args.length) stack.push(args[a]);
          else stack.push(valNull());
          break;

        // --- MATH ---
        case 0x10: // ADD
        case 0x11: // SUB
        case 0x12: // MUL
        case 0x13: // DIV
        case 0x14: // MOD
        case 0x15: // POW
        case 0x19: // ROOT
        case 0x1a: // LOG
          const valB = stack.pop();
          const valA = stack.pop();
          const nB = valB ? valB.num || 0 : 0;
          const nA = valA ? valA.num || 0 : 0;
          let res = 0;
          if (op == 0x10) res = nA + nB;
          if (op == 0x11) res = nA - nB;
          if (op == 0x12) res = nA * nB;
          if (op == 0x13) res = nB == 0 ? 0 : nA / nB;
          if (op == 0x14) res = nB == 0 ? 0 : nA % nB;
          if (op == 0x15) res = Math.pow(nA, nB);
          if (op == 0x19) {
            const degree = Math.floor(nB);
            const validDegree = degree != 0 && degree == nB;
            const invalidEvenNegative = nA < 0 && Math.abs(degree % 2) != 1;
            res =
              validDegree && !invalidEvenNegative
                ? Math.pow(nA, 1 / degree)
                : NaN;
          }
          if (op == 0x1a) {
            const validValue = nA > 0;
            const validBase = nB > 0 && nB != 1;
            res = validValue && validBase ? Math.log(nA) / Math.log(nB) : NaN;
          }
          stack.push(valNum(res));
          break;

        case 0x16: // FLOOR
        case 0x17: // CEIL
        case 0x18: // ROUND
          const roundIn = stack.pop() || valNull();
          const roundNum = valToNumber(roundIn);
          let roundOut = roundNum;
          if (op == 0x16) roundOut = Math.floor(roundNum);
          if (op == 0x17) roundOut = Math.ceil(roundNum);
          if (op == 0x18) roundOut = Math.round(roundNum);
          stack.push(valNum(roundOut));
          break;

        case 0x20: // CONCAT
          const strB = valToString(stack.pop() || valNull());
          const strA = valToString(stack.pop() || valNull());
          stack.push(valStr((strA + strB).substr(0, DFP1_MAX_STR_LEN)));
          break;

        case 0x21: // REPLACE_TEXT
          const repl = valToString(stack.pop() || valNull());
          const needle = valToString(stack.pop() || valNull());
          const source = valToString(stack.pop() || valNull());
          if (needle.length == 0) {
            stack.push(valStr(source.substr(0, DFP1_MAX_STR_LEN)));
          } else {
            stack.push(
              valStr(
                source.split(needle).join(repl).substr(0, DFP1_MAX_STR_LEN),
              ),
            );
          }
          break;

        case 0x22: // SUBTRACT_TEXT
          const subNeedle = valToString(stack.pop() || valNull());
          const subSource = valToString(stack.pop() || valNull());
          if (subNeedle.length == 0) {
            stack.push(valStr(subSource.substr(0, DFP1_MAX_STR_LEN)));
          } else {
            stack.push(
              valStr(
                subSource.split(subNeedle).join("").substr(0, DFP1_MAX_STR_LEN),
              ),
            );
          }
          break;

        case 0x23: // SLICE_TEXT
          const rawEnd = valToNumber(stack.pop() || valNull());
          const rawStart = valToNumber(stack.pop() || valNull());
          const sliceSource = valToString(stack.pop() || valNull());
          const sourceLen = sliceSource.length;

          let s = Math.floor(rawStart);
          if (s < 0) s = 0;
          if (s > sourceLen) s = sourceLen;

          let e = Math.floor(rawEnd) + 1;
          if (e < 0) e = 0;
          if (e > sourceLen) e = sourceLen;
          if (e < s) e = s;

          stack.push(
            valStr(sliceSource.substr(s, e - s).substr(0, DFP1_MAX_STR_LEN)),
          );
          break;

        case 0x60: // CMP_EQ
        case 0x61: // CMP_NEQ
        case 0x62: // CMP_LT
        case 0x63: // CMP_LTE
        case 0x64: // CMP_GT
        case 0x65: // CMP_GTE
          const cmpB = stack.pop() || valNull();
          const cmpA = stack.pop() || valNull();
          let cmpResult = false;
          if (op == 0x60 || op == 0x61) {
            cmpResult = valEquals(cmpA, cmpB);
            if (op == 0x61) cmpResult = !cmpResult;
          } else {
            const numA = valToNumber(cmpA);
            const numB = valToNumber(cmpB);
            if (op == 0x62) cmpResult = numA < numB;
            if (op == 0x63) cmpResult = numA <= numB;
            if (op == 0x64) cmpResult = numA > numB;
            if (op == 0x65) cmpResult = numA >= numB;
          }
          stack.push(valBool(cmpResult));
          break;

        case 0x70: // LOGIC_AND
        case 0x71: // LOGIC_NAND
        case 0x72: // LOGIC_OR
        case 0x73: // LOGIC_NOR
        case 0x74: // LOGIC_XOR
          const logicB = stack.pop() || valNull();
          const logicA = stack.pop() || valNull();
          const aTruth = valTruthy(logicA);
          const bTruth = valTruthy(logicB);
          let logicResult = false;
          if (op == 0x70) logicResult = aTruth && bTruth;
          if (op == 0x71) logicResult = !(aTruth && bTruth);
          if (op == 0x72) logicResult = aTruth || bTruth;
          if (op == 0x73) logicResult = !(aTruth || bTruth);
          if (op == 0x74) logicResult = aTruth != bTruth;
          stack.push(valBool(logicResult));
          break;

        case 0x75: // LOGIC_NOT
          const logicIn = stack.pop() || valNull();
          stack.push(valBool(!valTruthy(logicIn)));
          break;

        case 0x50: // LIST_COUNT
          const listCountVal = stack.pop() || valNull();
          const listCount =
            listCountVal.tag == DfpType.List ? listCountVal.list.length : 0;
          stack.push(valNum(listCount));
          break;

        case 0x51: // LIST_SORT_ASC
        case 0x52: // LIST_SORT_DESC
          const listSortVal = stack.pop() || valNull();
          const listItems =
            listSortVal.tag == DfpType.List ? listSortVal.list.slice() : [];
          const isNumeric = listItems.every(
            (item) => item.tag == DfpType.Number,
          );
          if (isNumeric) {
            listItems.sort((a, b) =>
              op == 0x51 ? a.num - b.num : b.num - a.num,
            );
          } else {
            listItems.sort((a, b) => {
              const left = valToString(a);
              const right = valToString(b);
              if (left == right) return 0;
              if (op == 0x51) return left < right ? -1 : 1;
              return left > right ? -1 : 1;
            });
          }
          stack.push(valList(listItems));
          break;

        case 0x53: // LIST_ACCUMULATE
          const listAccVal = stack.pop() || valNull();
          const accItems =
            listAccVal.tag == DfpType.List ? listAccVal.list : [];
          let acc = 0;
          for (let i = 0; i < accItems.length; i++) {
            if (accItems[i].tag == DfpType.Number) {
              acc += accItems[i].num;
            }
          }
          stack.push(valNum(acc));
          break;

        case 0x54: // LIST_ZIP
          const listB = stack.pop() || valNull();
          const listA = stack.pop() || valNull();
          const itemsA = listA.tag == DfpType.List ? listA.list : [];
          const itemsB = listB.tag == DfpType.List ? listB.list : [];
          const maxZip = Math.min(itemsA.length, itemsB.length);
          const zipped: DfpVal[] = [];
          for (let i = 0; i < maxZip; i++) {
            zipped.push(valList([itemsA[i], itemsB[i]]));
          }
          stack.push(valList(zipped));
          break;

        case 0x55: // LIST_UNZIP_A
        case 0x56: // LIST_UNZIP_B
          const listZipVal = stack.pop() || valNull();
          const zipItems =
            listZipVal.tag == DfpType.List ? listZipVal.list : [];
          const unzipIndex = op == 0x56 ? 1 : 0;
          const outItems: DfpVal[] = [];
          for (let i = 0; i < zipItems.length; i++) {
            const pair = zipItems[i];
            if (
              pair &&
              pair.tag == DfpType.List &&
              pair.list.length > unzipIndex
            ) {
              outItems.push(pair.list[unzipIndex]);
            }
          }
          stack.push(valList(outItems));
          break;

        case 0x30: // DISPLAY_TEXT
          const txt = valToString(stack.pop() || valNull());
          basic.showString(txt);
          break;

        case 0x31: // DISPLAY_NUM
          const numD = (stack.pop() || valNull()).num || 0;
          basic.showNumber(numD);
          break;

        case 0x32: // PLAY_TONE (ms, freq)
          const msT = (stack.pop() || valNull()).num || 0;
          const freqT = (stack.pop() || valNull()).num || 0;
          if (freqT > 0) music.playTone(freqT, msT);
          break;

        case 0x33: // WAIT (ms)
          const waitT = (stack.pop() || valNull()).num || 0;
          basic.pause(waitT);
          break;

        case 0x34: // READ_TEMP
          stack.push(valNum(input.temperature()));
          break;

        case 0x35: // READ_PIN
          const modeRaw = valToString(stack.pop() || valStr("digital"));
          const pinRaw = valToString(stack.pop() || valStr("P0"));
          const pinMode = normalizePinMode(modeRaw);
          const pinName = normalizePinName(pinRaw);
          const readValue =
            pinMode == "analog"
              ? readAnalogPinByName(pinName)
              : readDigitalPinByName(pinName);
          stack.push(valNum(readValue));
          break;

        case 0x36: // WRITE_PIN
          const writeModeRaw = valToString(stack.pop() || valStr("digital"));
          const writePinRaw = valToString(stack.pop() || valStr("P0"));
          const writeValueRaw = stack.pop() || valNum(0);
          const writeMode = normalizePinMode(writeModeRaw);
          const writePin = normalizePinName(writePinRaw);
          if (writeMode == "analog") {
            writeAnalogPinByName(writePin, valToNumber(writeValueRaw));
          } else {
            writeDigitalPinByName(writePin, valToNumber(writeValueRaw));
          }
          break;

        case 0x40: // RETURN
          const retVal = stack.pop() || valNull();
          dfpSendLine(
            `${DFP1_PREFIX}RESULT|0|RUN=${runId};VAL_HEX=${valEncodeHex(retVal)}`,
          );
          isProcessing = false;
          return; // Fin normal
      }

      // Pausa cooperativa cada 20 instrucciones para no bloquear BLE/UI
      if (pc % 20 == 0) basic.pause(1);
    }

    // Si sale del while sin RETURN
    dfpSendLine(
      `${DFP1_PREFIX}LOG|0|RUN=${runId};LVL=WARN;TXT_HEX=${dfpHexFromString("No Return")}`,
    );
    isProcessing = false;
  });
}

// ==========================================
// MANEJADOR DE PROTOCOLO DFP1
// ==========================================
function handleDfp1(line: string): boolean {
  if (line.indexOf(DFP1_PREFIX) != 0) return false;

  const parts = line.substr(5).split("|");
  const type = parts[0];
  const seq = parseInt(parts[1]) || 0;
  const payload = parts.slice(2).join("|");

  if (type == "HELLO_REQ") {
    const caps = "ALU,STR,DISPLAY,SOUND,UART,TEMP,GPIO";
    dfpSendLine(
      `${DFP1_PREFIX}HELLO_RES|${seq}|DEV=MICROBIT_V2;FW=1.0;CAPS=${caps};MAX_PROG=${DFP1_MAX_PROG_BYTES};MAX_CHUNK=64`,
    );
  } else if (type == "B" || type == "BEGIN" || type == "DEPLOY_BEGIN") {
    const prog = dfpGetField(payload, "PROG");
    const lenDecRaw = dfpGetField(payload, "LEN");
    const len36Raw = dfpGetField(payload, "L");
    let len = !lenDecRaw ? dfpParseBase36(len36Raw) : dfpParseDec(lenDecRaw);

    // Robustez: si LEN viene truncado o ausente, permitimos continuar.
    // El host enviará LEN en DEPLOY_COMMIT y ahí se valida/usa para CRC.
    if (isNaN(len) || len <= 0) {
      len = 0;
    }

    if (len > DFP1_MAX_PROG_BYTES) {
      dfpAck(seq, false, "OUT_OF_MEMORY", "Invalid LEN");
      return true;
    }

    dfpProgId = prog;
    dfpProgLen = len; // 0 => desconocido hasta DEPLOY_COMMIT
    // CRC32 se recibe en DEPLOY_COMMIT (host-side). Si viene aquí lo ignoramos.
    dfpProgCrc32 = 0;
    dfpProgCommitted = false;
    dfpMaxWritten = 0;
    dfpProgBuffer.fill(0);
    dfpAck(seq, true, "", "");
  } else if (type == "C" || type == "CHUNK" || type == "DEPLOY_CHUNK") {
    // PROG puede omitirse para acortar la línea (asumimos el último DEPLOY_BEGIN).
    const progRaw = dfpGetField(payload, "PROG");
    const prog = progRaw ? progRaw : dfpProgId;
    let offRaw = dfpGetField(payload, "OFF") || dfpGetField(payload, "O");
    let hex = dfpGetField(payload, "HEX") || dfpGetField(payload, "H");

    // Ultra-compact payload: X=O<off36>H<hex>
    const x = dfpGetField(payload, "X");
    if (x) {
      if (x.charAt(0) == "O") {
        const hIdx = x.indexOf("H");
        if (hIdx > 1) {
          offRaw = x.substr(1, hIdx - 1);
          hex = x.substr(hIdx + 1);
        } else {
          dfpAck(seq, false, "BAD_FORMAT", "Invalid X=" + x);
          return true;
        }
      } else {
        dfpAck(seq, false, "BAD_FORMAT", "Invalid X=" + x);
        return true;
      }
    }

    const off = dfpGetField(payload, "OFF")
      ? dfpParseDec(offRaw)
      : dfpParseBase36(offRaw);

    if (prog != dfpProgId) {
      dfpAck(seq, false, "UNKNOWN_PROG", "");
      return true;
    }

    if (isNaN(off) || off < 0 || off >= DFP1_MAX_PROG_BYTES) {
      // Payload de ejemplo esperado: OFF=0;HEX=... (y opcional PROG=...)
      const p0 = (payload || "").substr(0, 24);
      dfpAck(
        seq,
        false,
        "BAD_FORMAT",
        "Invalid OFF=" + offRaw + " LEN=" + dfpProgLen + " P0=" + p0,
      );
      return true;
    }

    // Si conocemos la longitud final, el offset debe caer dentro del programa.
    if (dfpProgLen > 0 && off >= dfpProgLen) {
      dfpAck(
        seq,
        false,
        "BAD_FORMAT",
        "Invalid OFF=" + offRaw + " LEN=" + dfpProgLen,
      );
      return true;
    }

    // Escribir directo al buffer
    const bytesWritten = dfpHexToBytesToBuffer(hex, dfpProgBuffer, off);
    if (bytesWritten == 0) {
      dfpAck(seq, false, "BAD_HEX", "hexlen=" + (hex ? ("" + hex).length : 0));
    } else {
      const end = off + bytesWritten;
      if (end > dfpMaxWritten) dfpMaxWritten = end;
      dfpAck(seq, true, "", "");
    }
  } else if (type == "M" || type == "COMMIT" || type == "DEPLOY_COMMIT") {
    const prog = dfpGetField(payload, "PROG");
    const lenDecRaw = dfpGetField(payload, "LEN");
    const len36Raw = dfpGetField(payload, "L");
    const len = !lenDecRaw ? dfpParseBase36(len36Raw) : dfpParseDec(lenDecRaw);

    // CRC can come as decimal (CRC32=) or base36 (R=)
    const crcDecRaw = dfpGetField(payload, "CRC32");
    const crc36Raw = dfpGetField(payload, "R");
    const crcParsed = !crcDecRaw
      ? dfpParseBase36(crc36Raw)
      : dfpParseDec(crcDecRaw);
    const crc = (isNaN(crcParsed) ? 0 : crcParsed) >>> 0;

    if (!isNaN(len) && len > 0 && len <= DFP1_MAX_PROG_BYTES) {
      dfpProgLen = len;
    }
    if (crc != 0) dfpProgCrc32 = crc;

    // If LEN was missing/truncated, infer it from received chunks.
    if (dfpProgLen <= 0) {
      dfpProgLen = dfpMaxWritten;
    }

    if (dfpProgLen <= 0) {
      dfpAck(seq, false, "BAD_FORMAT", "Invalid LEN");
      return true;
    }
    // Verificar CRC
    const currentCrc = calcBufferCrc32(dfpProgBuffer, dfpProgLen);

    if (currentCrc != dfpProgCrc32 && dfpProgCrc32 != 0) {
      dfpAck(seq, false, "CRC_FAIL", "");
    } else {
      dfpProgCommitted = true;
      // Clear any pending compact args after a successful commit.
      dfpArgsRunId = "";
      dfpArgsHex = "";
      dfpAck(seq, true, "", "");
    }
  } else if (type == "A") {
    // Ultra-compact args chunk: I=<runId>;X=<hex>
    let runId = dfpGetField(payload, "I");
    if (!runId) runId = "" + seq;
    const x = dfpGetField(payload, "X");

    if (!dfpProgCommitted) {
      dfpAck(seq, false, "NO_PROG", "");
      return true;
    }

    if (dfpArgsRunId && dfpArgsRunId != runId) {
      // New run id starts; reset buffer.
      dfpArgsHex = "";
    }
    dfpArgsRunId = runId;
    dfpArgsHex += x;
    dfpAck(seq, true, "", "");
  } else if (type == "RUN" || type == "R") {
    // PROG puede omitirse (asumimos el último programa comprometido)
    const progRaw = dfpGetField(payload, "PROG");
    const prog = progRaw ? progRaw : dfpProgId;

    // RUN id puede venir como RUN= (legacy) o I= (compact)
    let runId = dfpGetField(payload, "RUN");
    if (!runId) runId = dfpGetField(payload, "I");
    if (!runId) runId = "" + seq;

    // ARGS puede venir como ARGS_HEX= (legacy) o por chunks previos A/I/X
    const argsHexRaw = dfpGetField(payload, "ARGS_HEX");
    let argsHex = argsHexRaw;
    if (!argsHex) {
      // Backward-compat: A=<argsHex> inline
      argsHex = dfpGetField(payload, "A");
    }
    if (!argsHex && dfpArgsRunId == runId) {
      // Ultra-compact: buffered chunks
      argsHex = dfpArgsHex;
    }

    if (!dfpProgCommitted || prog != dfpProgId) {
      dfpAck(seq, false, "NO_PROG", "");
      return true;
    }

    dfpAck(seq, true, "", ""); // Confirmamos recepción

    // Decodificar argumentos y correr VM
    const args = decodeArgs(argsHex);
    // Clear buffered args for this run id to avoid accidental reuse.
    if (dfpArgsRunId == runId) {
      dfpArgsRunId = "";
      dfpArgsHex = "";
    }
    dfpStopRunId = "";
    executeVm(runId, args);
  } else if (type == "STOP") {
    dfpStopRunId = dfpGetField(payload, "RUN");
    if (!dfpStopRunId) dfpStopRunId = dfpGetField(payload, "I");
    dfpAck(seq, true, "", "");
  } else if (type == "PING") {
    dfpSendLine(`${DFP1_PREFIX}PONG|${seq}|`);
  }

  return true;
}

// ==========================================
// LOOP PRINCIPAL Y COMANDOS LEGACY
// ==========================================

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

function processInput(msg: string) {
  const cleanMsg = (msg || "").trim();
  if (cleanMsg.length == 0) return;

  if (handleDfp1(cleanMsg)) return;

  if (cleanMsg.indexOf("TXT:") == 0) {
    basic.showString(cleanMsg.substr(4));
  } else if (cleanMsg.indexOf("SND:") == 0) {
    const payload = cleanMsg.substr(4).trim();
    let freq = NaN;
    let durationMs = 250;

    if (payload.indexOf(",") >= 0) {
      const parts = payload.split(",");
      freq = parseInt((parts[0] || "").trim());
      const parsedDuration = parseInt((parts[1] || "").trim());
      if (!isNaN(parsedDuration) && parsedDuration > 0) {
        durationMs = parsedDuration;
      }
    } else {
      freq = parseInt(payload);
    }

    if (!isNaN(freq) && freq > 0) {
      music.playTone(freq, durationMs);
    }
  } else if (cleanMsg == "TEMP?") {
    const out = "TEMP:" + input.temperature();
    serial.writeLine(out);
    bluetooth.uartWriteLine(out);
  } else if (cleanMsg.indexOf("PINR?:") == 0) {
    const payload = cleanMsg.substr(6).trim();
    const parts = payload.split(",");
    const pin = normalizePinName(parts.length > 0 ? parts[0] : "P0");
    const mode = normalizePinMode(parts.length > 1 ? parts[1] : "digital");
    const value =
      mode == "analog" ? readAnalogPinByName(pin) : readDigitalPinByName(pin);
    const out = "PINR:" + value;
    serial.writeLine(out);
    bluetooth.uartWriteLine(out);
  } else if (cleanMsg.indexOf("PINW:") == 0) {
    const payload = cleanMsg.substr(5).trim();
    const parts = payload.split(",");
    const pin = normalizePinName(parts.length > 0 ? parts[0] : "P0");
    const mode = normalizePinMode(parts.length > 1 ? parts[1] : "digital");
    const rawValue = parseFloat(parts.length > 2 ? parts[2] : "0");
    const value = isNaN(rawValue) ? 0 : rawValue;

    if (mode == "analog") {
      writeAnalogPinByName(pin, value);
    } else {
      writeDigitalPinByName(pin, value);
    }
  }
}

// Listeners
bluetooth.onUartDataReceived(
  serial.delimiters(Delimiters.NewLine),
  function () {
    processInput(
      bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine)),
    );
  },
);

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
  processInput(serial.readUntil(serial.delimiters(Delimiters.NewLine)));
});

// Indicador de listo
basic.showIcon(IconNames.Happy);
