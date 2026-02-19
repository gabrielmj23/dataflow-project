# Micro:bit Dataflow Protocol (DFP1)

Este documento define un **protocolo unificado (Serial + Bluetooth UART)** para enviar “subflujos” (programas compilados) desde Dataflow al micro:bit.

Objetivo: que el host pueda **deployar** un subflujo, **ejecutarlo** con argumentos, y recibir **resultado/logs/eventos**, de forma robusta en enlaces con MTU pequeña (BLE) y posibles fragmentaciones.

## 1) Transporte

- **Medio**: USB Serial (Web Serial) o BLE UART (microbit-web-bluetooth).
- **Codificación**: UTF-8.
- **Framing**: **1 mensaje = 1 línea** terminada en `\n`.
  - El receptor debe aceptar `\r\n` y recortar `\r`.
- **Longitud recomendada**: mantener líneas **≤ 180 caracteres**; para payloads grandes usar chunking (sección 3).

Nota BLE:

- En algunos entornos, el enlace BLE/UART puede truncar lecturas/escrituras cerca de **20 caracteres**.
- Para ese caso existe un modo **ultra-compacto** (tipos `B/C/M` para deploy y `A/R` para ejecución) descrito en este documento.

Esto es compatible con el firmware actual (que ya procesa por delimitador `NewLine`).

## 2) Formato de frame (línea)

Todos los mensajes del protocolo empiezan por el prefijo `DFP1|`.

```
DFP1|<TYPE>|<SEQ>|<PAYLOAD>
```

- `TYPE`: string en mayúsculas (sin `|`).
- `SEQ`: entero decimal `0..65535` (para ACK / correlación). El host incrementa por envío.
- `PAYLOAD`: lista de campos `k=v` separados por `;`.
  - `k`: `[A-Z0-9_]+`
  - `v`: por defecto ASCII simple (sin `;`), y para binario usar **HEX** (base16) o texto UTF-8 en **HEX UTF-8**.

Convenciones:

- Binario: `HEX=<hex>` (bytes en hexadecimal, mayúsculas o minúsculas, longitud par).
- Texto arbitrario: `TXT_HEX=<hex_utf8>`.
- IDs: `ID=<token>` (token sin espacios; sugerido `[-._a-zA-Z0-9]+`).

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

`CODE` recomendado: `BAD_FORMAT`, `UNSUPPORTED`, `CRC_FAIL`, `OUT_OF_MEMORY`, `UNKNOWN_PROGRAM`, `BUSY`.

### Chunking (envío de bytecode)

Flujo recomendado:

1. `BEGIN` (metadatos)
2. `CHUNK` repetido
3. `COMMIT` (verificación final)

Compatibilidad:

- El firmware/host puede aceptar también los aliases largos `DEPLOY_BEGIN`, `DEPLOY_CHUNK`, `DEPLOY_COMMIT`.
- El host debería **emitir** los nombres cortos para reducir el tamaño de línea en BLE.

Modo ultra-compacto (BLE muy limitado):

- `B` (BEGIN): `DFP1|B|0|L=<len_base36>;C=<chunk_bytes>`
- `C` (CHUNK): `DFP1|C|0|X=O<off_base36>H<hex>` (donde `hex` suele ser 2 bytes => 4 chars)
- `M` (COMMIT): `DFP1|M|0|R=<crc32_base36>`
- `A` (ARGS chunk): `DFP1|A|0|I=<run_id>;X=<hex>` (chunk de argumentos; típicamente 1 byte => 2 chars)
- `R` (RUN): `DFP1|R|<SEQ>|I=<run_id>`

Notas:

- En `C`, el firmware puede inferir `LEN` como el máximo `OFF+bytes` recibido.
- El host puede omitir `PROG` para minimizar tamaño (se asume 1 programa activo).
- En modo ultra-compacto, el host puede usar `SEQ=0` para `B/C/M/A` (y recibir `ACK` con `SEQ=0`).

Mensajes:

- `BEGIN`

  ```
  DFP1|BEGIN|10|PROG=<id>;LEN=<bytes>;CHUNK=<bytes>
  ```

  Notas:
  - `LEN` puede omitirse o venir truncado en enlaces BLE. El host debe reenviar `LEN` en `COMMIT`.
  - `CRC32` se envía en `COMMIT`.

- `CHUNK`

  ```
  DFP1|CHUNK|11|PROG=<id>;OFF=<bytes>;HEX=<hex>
  ```

  Nota:
  - Para reducir aún más la línea, `PROG` puede omitirse si ya hubo `BEGIN` (se asume el último programa activo).

- `COMMIT`
  ```
  DFP1|COMMIT|12|PROG=<id>;LEN=<bytes>;CRC32=<u32_dec>
  ```

Notas:

- `OFF` es el offset absoluto dentro del bytecode.
- `HEX` debe contener **≤ CHUNK bytes** (en hex será `2*bytes` chars).
- Si falta un chunk o llega corrupto, el micro:bit debe responder `ACK OK=0`.

## 4) Control de ejecución

### RUN

Ejecuta un programa previamente deployado.

```
DFP1|RUN|20|PROG=<id>;RUN=<run_id>;ARGS_HEX=<hex>
```

- `RUN` es un ID de corrida (`u16` o string token) para correlacionar resultado.
- `ARGS_HEX` es un payload binario (ver formato en sección 6).

#### RUN ultra-compacto (recomendado para enlaces con truncación ~20 chars)

Para evitar truncación, en lugar de enviar `ARGS_HEX` inline en `RUN`, el host envía los argumentos por chunks y luego dispara la ejecución:

1. Uno o más `A`:

```
DFP1|A|0|I=<run_id>;X=<hex>
```

- `I` es el `run_id` (token corto recomendado, p.ej. base36).
- `X` es un fragmento de `ARGS_HEX` (hex). Recomendado: **2 chars** por frame (1 byte) para mantener la línea muy corta.

2. Luego `R` para ejecutar:

```
DFP1|R|<SEQ>|I=<run_id>
```

- El firmware reconstruye `ARGS_HEX` concatenando los `X` recibidos para ese `run_id`.
- `PROG` se omite (se asume el último programa comprometido).

### STOP

```
DFP1|STOP|21|RUN=<run_id>
```

Compatibilidad/compacto:

```
DFP1|STOP|21|I=<run_id>
```

### RESULT / LOG

- Resultado:
  ```
  DFP1|RESULT|0|RUN=<run_id>;VAL_HEX=<hex>
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
- `STR` (strings)
- `DISPLAY` (matriz LED / showString/showNumber)
- `SOUND`
- `PINS`
- `BUTTONS`
- `SENSORS`

El host debe compilar/validar el subflujo según `CAPS`.

## 6) Formato binario (bytecode) — “DFBC1”

El subflujo se envía como **bytecode** (ver `BEGIN/CHUNK/COMMIT`).

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

### 6.2 Const pool

Cada entrada:

- `tag` (u8): `0=number_f32`, `1=string_utf8`, `2=bool`, `3=null`
- payload:
  - number: `float32` (4 bytes)
  - bool: `u8` (0/1)
  - null: sin payload
  - string: `u16 len` + `len` bytes UTF-8

### 6.3 Instrucciones (formato fijo 4 bytes)

Cada instrucción: `[op:u8][a:u8][b:u8][c:u8]`.

Stack machine (LIFO). El intérprete opera sobre una pila de valores (number/string/bool/null).

Opcodes iniciales (MVP):

- `0x01 PUSH_CONST a=constIndex`
- `0x02 LOAD_ARG a=argIndex`
- `0x10 ADD` / `0x11 SUB` / `0x12 MUL` / `0x13 DIV` / `0x14 MOD` / `0x15 POW`
- `0x16 FLOOR` / `0x17 CEIL` / `0x18 ROUND`
- `0x20 CONCAT`
- `0x30 DISPLAY_TEXT` (pop string)
- `0x31 DISPLAY_NUMBER` (pop number)
- `0x32 PLAY_TONE` (pop ms, pop freq)
- `0x40 RETURN` (pop value)

Reglas:

- La mayoría de opcodes consumen sus operandos de la pila.
- `RETURN` termina la ejecución y envía `RESULT`.

Limitaciones MVP (por simplicidad):

- **Sin branching/loops** al inicio (subflujos deben ser DAG sin ciclos y sin condicionales).
- Tamaño máximo de programa `MAX_PROG` y chunk `MAX_CHUNK` se negocian en handshake.

## 7) Argumentos y valores (VAL_HEX / ARGS_HEX)

Para `ARGS_HEX` y `VAL_HEX` se usa una codificación binaria simple:

- `tag:u8` + payload
  - `0=number_f32` + 4 bytes
  - `1=string_utf8` + `u16 len` + bytes
  - `2=bool` + `u8`
  - `3=null`

`ARGS_HEX` contiene:

- `argc:u8` seguido de `argc` valores.

`VAL_HEX` contiene un solo valor.

## 8) Compatibilidad con comandos actuales

El firmware actual entiende comandos tipo `SUM:`, `TXT:` etc.
Este protocolo **no rompe eso**: el firmware puede mantener ambos parsers:

- Si la línea empieza con `DFP1|` → parser DFP1
- Si no → parser legacy
