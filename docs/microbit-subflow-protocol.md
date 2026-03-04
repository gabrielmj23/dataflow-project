# Micro:bit Dataflow Protocol (DFP1)

Este documento define un **protocolo unificado (Serial + Bluetooth UART)** para enviar “subflujos” (programas compilados) desde Dataflow al micro:bit.

Objetivo: que el host pueda **deployar** un subflujo, **ejecutarlo** con argumentos, y recibir **resultado/logs/eventos**, de forma robusta en enlaces con MTU pequeña (BLE) y posibles fragmentaciones.

## 1) Transporte

- **Medio**: USB Serial (Web Serial) o BLE UART (microbit-web-bluetooth).
- **Codificación**: UTF-8 / ASCII.
- **Framing**: **1 mensaje = 1 línea** terminada en `\n`.
  - El receptor debe aceptar `\r\n` y recortar `\r`.

Nota BLE:

- En algunos entornos, el enlace BLE/UART puede truncar lecturas/escrituras cerca de **20 caracteres**.
- En Bluetooth, el host envía cada línea en chunks de **18 caracteres** para evitar saturación del buffer.

## 2) Formato de frame (línea)

Todos los mensajes del protocolo empiezan por el prefijo `DFP1|`.

```
DFP1|<TYPE>|<SEQ>|<PAYLOAD>
```

- `TYPE`: string en mayúsculas (sin `|`).
- `SEQ`: entero decimal `0..65535` (para ACK / correlación).
- `PAYLOAD`: lista de campos `k=v` separados por `;`.
  - `k`: `[A-Z0-9_]+`
  - `v`: por defecto ASCII simple (sin `;`), y para binario usar **HEX** (base16).

Convenciones:

- Binario: `HEX=<hex>` (bytes en hexadecimal, mayúsculas o minúsculas, longitud par).
- Texto arbitrario: `TXT_HEX=<hex_utf8>`.
- IDs: `ID=<token>` (token sin espacios; sugerido `[-._a-zA-Z0-9]+`).

Notas de parsing:

- El payload no debe contener `|`.
- El parser no hace escaping automático.
- Si un valor requiere `;` o `=`, debe enviarse en HEX.

Ejemplo:

```
DFP1|PING|1|
DFP1|HELLO_RES|2|DEV=MBIT-123;FW=0.1.0;CAPS=ALU,DISPLAY,UART;MAX_PROG=2048;MAX_CHUNK=32
```

## 3) ACK, reintentos y chunking

### ACK

Para mensajes críticos (BEGIN/CHUNK/COMMIT, RUN, STOP) el receptor responde:

- OK:
  `DFP1|ACK|<SEQ>|OK=1`
- Error:
  `DFP1|ACK|<SEQ>|OK=0;ERR=<CODE>;MSG_HEX=<hex_utf8>`

Correlación de ACK aceptada por host:

1. `ACK.seq == SEQ del frame enviado`
2. `ACK.payload` incluye `ACK`, `SEQ` o `REF` con el `SEQ` enviado
3. Si no hay campo de referencia, se acepta el siguiente `ACK` recibido

`CODE` recomendado: `BAD_FORMAT`, `UNSUPPORTED`, `CRC_FAIL`, `OUT_OF_MEMORY`, `UNKNOWN_PROGRAM`, `BUSY`.

### Chunking (envío de bytecode)

Flujo recomendado:

1. `B` (BEGIN, metadatos)
2. `C` (CHUNK, repetido)
3. `M` (COMMIT, verificación final)

Compatibilidad:

- También pueden aceptarse `BEGIN/CHUNK/COMMIT` y aliases `DEPLOY_BEGIN/DEPLOY_CHUNK/DEPLOY_COMMIT`.

- `B` (BEGIN): `DFP1|B|0|L=<len_base36>;C=<chunk_bytes>`
- `C` (CHUNK): `DFP1|C|0|X=O<off_base36>H<hex>`
- `M` (COMMIT): `DFP1|M|0|R=<crc32_base36>`
- `A` (ARGS chunk): `DFP1|A|0|I=<run_id>;X=<hex>`
- `R` (RUN): `DFP1|R|<SEQ>|I=<run_id>`

Notas:

- En `C`, el firmware puede inferir `LEN` como el máximo `OFF+bytes` recibido.
- En modo compacto, `PROG` puede omitirse (se asume programa activo).
- En modo compacto, `SEQ=0` para `B/C/M/A`.

Parámetros de envío recomendados:

- Deploy chunk: `1 byte` por frame (`C`).
- Args chunk: `1 byte` por frame (`A`, es decir `X` de 2 chars hex).

Timeouts/reintentos sugeridos:

- `B/C/A`: timeout 3000ms, retries 1
- `M`: timeout 5000ms, retries 1
- `R`: timeout 90000ms

## 4) Control de ejecución

### RUN

Ejecución en modo compacto:

1. Uno o más `A`:

```
DFP1|A|0|I=<run_id>;X=<hex>
```

2. Luego `R` para ejecutar:

```
DFP1|R|<SEQ>|I=<run_id>
```

- `I` es el `run_id`.
- El firmware reconstruye `ARGS_HEX` concatenando los `X` recibidos para ese `run_id`.

Compatibilidad RUN largo:

```
DFP1|RUN|20|PROG=<id>;RUN=<run_id>;ARGS_HEX=<hex>
```

### STOP

```
DFP1|STOP|21|RUN=<run_id>
```

Compatibilidad:

```
DFP1|STOP|21|I=<run_id>
```

### RESULT / LOG

- Resultado:
  ```
  DFP1|RESULT|0|RUN=<run_id>;VAL_HEX=<hex>
  ```
  Compatibilidad:
  ```
  DFP1|RESULT|0|I=<run_id>;VAL_HEX=<hex>
  ```
- Logs (opcional):
  ```
  DFP1|LOG|0|RUN=<run_id>;LVL=INFO;TXT_HEX=<hex_utf8>
  ```

`SEQ` puede ser `0` en mensajes espontáneos desde micro:bit (no ACK).

## 5) Handshake y capacidades

- Host → micro:bit:
  `DFP1|HELLO_REQ|1|`

- micro:bit → host:
  `DFP1|HELLO_RES|1|DEV=<id>;FW=<semver>;CAPS=<csv>;MAX_PROG=<bytes>;MAX_CHUNK=<bytes>`

`CAPS` recomendado:

- `ALU` (operaciones numéricas)
- `STR` (strings; concat, replace, subtract, slice)
- `DISPLAY` (matriz LED / showString/showNumber)
- `SOUND`
- `PINS`
- `BUTTONS`
- `SENSORS`
- `LIST`
- `LOGIC`

El host puede compilar/validar el subflujo según `CAPS`.

## 6) Formato binario (bytecode) — “DFBC1”

El subflujo se envía como **bytecode** (ver `B/C/M` o `BEGIN/CHUNK/COMMIT`).

### 6.1 Header

Little-endian.

| Offset |       Tamaño | Campo                 |
| -----: | -----------: | --------------------- |
|      0 |            4 | Magic: ASCII `DFBC`   |
|      4 |            1 | Version: `1`          |
|      5 |            1 | Flags (reservado)     |
|      6 |            1 | `constCount` (0..255) |
|      7 |            1 | `argCount` (0..255)   |
|      8 |            2 | `instCount` (u16)     |
|     10 |          var | Const pool            |
|     .. | 4\*instCount | Instrucciones         |

### 6.2 Const pool y valores

Cada entrada:

- `tag` (u8):
  - `0=number_f32`
  - `1=string` (`u16 len` + bytes)
  - `2=bool`
  - `3=null`
  - `4=list` (`u8 len` + valores anidados)

Codificación de string: bytes simples (Latin-1).

### 6.3 Instrucciones (formato fijo 4 bytes)

Cada instrucción: `[op:u8][a:u8][b:u8][c:u8]`.

Stack machine (LIFO).

Opcodes:

- `0x01 PUSH_CONST a=constIndex`
- `0x02 LOAD_ARG a=argIndex`
- `0x10 ADD` / `0x11 SUB` / `0x12 MUL` / `0x13 DIV` / `0x14 MOD` / `0x15 POW`
- `0x16 FLOOR` / `0x17 CEIL` / `0x18 ROUND`
- `0x20 CONCAT`
- `0x21 REPLACE_TEXT` / `0x22 SUBTRACT_TEXT` / `0x23 SLICE_TEXT`
- `0x30 DISPLAY_TEXT` (pop string)
- `0x31 DISPLAY_NUMBER` (pop number)
- `0x32 PLAY_TONE` (pop ms, pop freq)
- `0x34 READ_TEMP`
- `0x50 LIST_COUNT` / `0x51 LIST_SORT_ASC` / `0x52 LIST_SORT_DESC`
- `0x53 LIST_ACCUMULATE` / `0x54 LIST_ZIP` / `0x55 LIST_UNZIP_A` / `0x56 LIST_UNZIP_B`
- `0x60 CMP_EQ` / `0x61 CMP_NEQ` / `0x62 CMP_LT` / `0x63 CMP_LTE` / `0x64 CMP_GT` / `0x65 CMP_GTE`
- `0x70 LOGIC_AND` / `0x71 LOGIC_NAND` / `0x72 LOGIC_OR` / `0x73 LOGIC_NOR` / `0x74 LOGIC_XOR` / `0x75 LOGIC_NOT`
- `0x40 RETURN` (pop value)

## 7) Argumentos y valores (VAL_HEX / ARGS_HEX)

Para `ARGS_HEX` y `VAL_HEX` se usa una codificación binaria simple:

- `tag:u8` + payload
  - `0=number_f32` + 4 bytes
  - `1=string` + `u16 len` + bytes
  - `2=bool` + `u8`
  - `3=null`
  - `4=list` + `u8 len` + valores anidados

`ARGS_HEX` contiene:

- `argc:u8` seguido de `argc` valores.

`VAL_HEX` contiene un solo valor.
