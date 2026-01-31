//@ts-nocheck

// Configuración de Hardware
serial.redirectToUSB();
serial.setBaudRate(BaudRate.BaudRate115200);
bluetooth.startUartService();

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
}
class DfpVal {
  tag: DfpType;
  num: number;
  str: string;
  bool: boolean;
  constructor(t: DfpType) {
    this.tag = t;
    this.num = 0;
    this.str = "";
    this.bool = false;
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

function valToString(v: DfpVal): string {
  if (v.tag == DfpType.Number) return "" + v.num;
  if (v.tag == DfpType.String) return v.str;
  if (v.tag == DfpType.Bool) return v.bool ? "true" : "false";
  return "null";
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
  }
  return "03";
}

// Decodifica argumentos entrantes en HEX
function decodeArgs(hex: string): DfpVal[] {
  const args: DfpVal[] = [];
  const buf = dfpHexToBuffer(hex);
  let off = 0;
  if (buf.length == 0) return args;

  // El primer byte es la cantidad de argumentos
  const argc = buf[off++];

  for (let i = 0; i < argc && off < buf.length; i++) {
    const tag = buf[off++];
    if (tag == 0) {
      // Number
      const n = buf.getNumber(NumberFormat.Float32LE, off);
      args.push(valNum(n));
      off += 4;
    } else if (tag == 1) {
      // String
      const len = buf.getNumber(NumberFormat.UInt16LE, off);
      off += 2;
      const s = buf.slice(off, len).toString();
      args.push(valStr(s));
      off += len;
    } else if (tag == 2) {
      // Bool
      const b = buf[off++] != 0;
      args.push(valBool(b));
    } else {
      // Null
      args.push(valNull());
    }
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
      const tag = dfpProgBuffer[offset++];
      if (tag == 0) {
        const n = dfpProgBuffer.getNumber(NumberFormat.Float32LE, offset);
        constPool.push(valNum(n));
        offset += 4;
      } else if (tag == 1) {
        const len = dfpProgBuffer.getNumber(NumberFormat.UInt16LE, offset);
        offset += 2;
        const s = dfpProgBuffer.slice(offset, len).toString();
        constPool.push(valStr(s));
        offset += len;
      } else if (tag == 2) {
        constPool.push(valBool(dfpProgBuffer[offset++] != 0));
      } else {
        constPool.push(valNull());
      }
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
          stack.push(valNum(res));
          break;

        case 0x20: // CONCAT
          const strB = valToString(stack.pop() || valNull());
          const strA = valToString(stack.pop() || valNull());
          stack.push(valStr((strA + strB).substr(0, DFP1_MAX_STR_LEN)));
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
    const caps = "ALU,STR,DISPLAY,SOUND,UART";
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

function processInput(msg: string) {
  const cleanMsg = (msg || "").trim();
  if (cleanMsg.length == 0) return;

  // Intentar protocolo DFP1
  if (handleDfp1(cleanMsg)) return;

  // Comandos Legacy
  if (cleanMsg.indexOf("TXT:") == 0) {
    basic.showString(cleanMsg.substr(4));
  } else if (cleanMsg.indexOf("ICON:") == 0) {
    const iconId = parseInt(cleanMsg.substr(5));
    if (iconId == 1) basic.showIcon(IconNames.Heart);
    else basic.showIcon(IconNames.Yes);
  } else if (cleanMsg.indexOf("SUM:") == 0) {
    const parts = cleanMsg.substr(4).split(",");
    const val = parseFloat(parts[0]) + parseFloat(parts[1]);
    basic.showNumber(val);
    const out = "SUM:" + val;
    serial.writeLine(out);
    bluetooth.uartWriteLine(out);
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
