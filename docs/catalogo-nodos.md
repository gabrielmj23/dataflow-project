# Catalogo de Nodos del Lenguaje Dataflow

Este documento describe el catalogo completo de nodos disponible actualmente en el editor Dataflow, alineado con la implementacion real de UI + compiladores + motor.

Incluye:

- Nodos visibles en la paleta.
- Nodos internos usados en subflujos.
- Nodos compuestos (macro) y nodos solo de UI.
- Puertos, patron de activacion, semantica y soporte de ejecucion remota.

---

## 1. Conceptos Base

### 1.1 Patrones de activacion (FirePatterns)

- `EXISTS`: requiere token en ese puerto para activarse.
- `DONT_CARE`: no requiere token; usa valor por defecto o `undefined`.
- `ALWAYS`: se evalua en cada paso sin entrada externa.

### 1.2 Puertos sticky

Un puerto sticky conserva el ultimo valor recibido. Si llega un token por otro puerto, el nodo puede reactivarse reutilizando ese valor almacenado.

### 1.3 Destinos de ejecucion (`executionTarget`)

- `local`: ejecucion en navegador (runner local).
- `controller`: delega operacion/subflujo a controlador remoto via WebSocket.
- `microbit`: ejecuta en micro:bit (serial o bluetooth), segun nodo.

### 1.4 Notas de alcance

- Este catalogo refleja tipos de nodo del proyecto (`NODE_TYPES`) y nodos registrados en el editor.
- El nodo `comment` es solo visual y no se compila al motor.
- `conditionalPair` es un item de paleta que crea dos nodos reales: `conditional` + `conditionalSelector`.

---

## 2. Nodos de Entrada

Todos tienen salida principal `output`.

### 2.1 `constantInput` (Constante generica)

- Funcion: emite un valor constante (numero/texto/booleano).
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: local.

### 2.2 `constantNumber`

- Funcion: emite numero constante.
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: local.

### 2.3 `constantBoolean`

- Funcion: emite booleano constante.
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: local.

### 2.4 `constantText`

- Funcion: emite texto constante.
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: local.

### 2.5 `constantList`

- Funcion: emite lista constante (normaliza items numericos cuando aplica).
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: local.

### 2.6 `runtimeInput`

- Funcion: solicita valor al usuario en tiempo de ejecucion.
- Config: `valueType` (`number` o `text`), `prompt`, `defaultValue`.
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: local.

### 2.7 `randomInput`

- Funcion: genera aleatorio en rango `[min,max]`.
- Config: `min`, `max`, `integerOnly`.
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: local.

### 2.8 `choiceInput`

- Funcion: elige aleatoriamente un elemento de `choices`.
- Config: `choices: string[]`.
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: local.

### 2.9 `timerInput`

- Funcion: espera `timeValue` segundos y reemite.
- Modos:
- `source`: sin entrada, emite `0` tras retardo.
- `delay`: con entrada, reemite el valor entrante tras retardo.
- Config: `timeValue` (segundos).
- Entradas: `input` (solo modo delay).
- Salidas: `output`.
- Activacion: `DONT_CARE` (source) o `EXISTS` (delay).
- Sticky: no.
- Distribucion: local.

### 2.10 `microbitReadButton`

- Funcion: espera evento de boton en micro:bit y emite `A`, `B` o `AB`.
- Config: `transport` (`serial`/`bluetooth`), slot.
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: micro:bit.

### 2.11 `microbitReadTemperature`

- Funcion: solicita y emite temperatura de micro:bit (grados C).
- Config: `transport` (`serial`/`bluetooth`), slot.
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: micro:bit.

### 2.12 `microbitReadPin`

- Funcion: lee pin de micro:bit (digital o analogico).
- Config: `transport`, slot, `pin`, `mode` (`digital`/`analog`).
- Entradas: ninguna.
- Salidas: `output`.
- Activacion: `ALWAYS`.
- Sticky: no.
- Distribucion: micro:bit.

---

## 3. Nodos de Procesamiento Matematico y Texto

### 3.1 Operaciones matematicas binarias

Nodos: `sum`, `subtract`, `multiply`, `divide`, `mod`, `power`, `root`, `logarithm`, `mathOperation`.

- Entradas: `input1`, `input2`.
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si (`input1`, `input2`).
- Distribucion:
- `sum/subtract/multiply/divide/mod/power/root/logarithm`: local, controller, micro:bit.
- `mathOperation`: wrapper configurable para `sum/subtract/multiply/divide/mod/power` con mismo esquema.

Validaciones destacadas:

- `divide`: error en division no finita.
- `power`: error en `0^0` o resultado no finito.
- `root`: grado entero distinto de 0; valida raiz real para negativos.
- `logarithm`: valor > 0, base > 0 y base != 1.

### 3.2 Operaciones matematicas unarias

Nodos: `floor`, `ceiling`, `round`.

- Entradas: `input1`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`input1`).
- Distribucion: local, controller, micro:bit.

### 3.3 `formulaEditor`

- Funcion: evalua formula aritmetica definida por usuario.
- Config: `formula`, `variables`.
- Entradas: dinamicas `input1..inputN` (segun variables).
- Salidas: `output`.
- Activacion: todos `EXISTS`.
- Sticky: si (todas las entradas).
- Distribucion: local.

### 3.4 Texto

#### `concat`

- Entradas: `input1`, `input2`.
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.

#### `replaceText`

- Entradas: `text`, `search`, `replacement`.
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.
- Nota: si `search` es vacio, devuelve texto original.

#### `subtractText`

- Entradas: `text`, `search`.
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.

#### `sliceText`

- Entradas: `text`, `start`, `end` (fin inclusivo en semantica de usuario).
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.

---

## 4. Nodos de Logica y Control de Flujo

### 4.1 Comparaciones

Nodos:

- `comparison` (operador configurable)
- `comparisonEqual` (`==`)
- `comparisonNotEqual` (`!=`)
- `comparisonLess` (`<`)
- `comparisonLessOrEqual` (`<=`)
- `comparisonGreater` (`>`)
- `comparisonGreaterOrEqual` (`>=`)

Comun:

- Entradas: `input1`, `input2`.
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: no (en local).
- Distribucion: local, micro:bit.

### 4.2 Compuertas logicas

Nodos: `and`, `nand`, `or`, `nor`, `xor`, `not`, `logicOperation`.

- `and/nand/or/nor/xor`: entradas `input1`, `input2`, salida `output`.
- `not`: entrada `input`, salida `output`.
- `logicOperation`: configurable entre las anteriores.
- Activacion: `EXISTS` por cada entrada requerida.
- Sticky: no (en local).
- Distribucion: local, micro:bit.

### 4.3 `switch`

- Funcion: evalua condiciones ordenadas y emite por la primera salida que cumple.
- Config: `conditions[]` con `operator` y `target`.
- Operadores: `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `startsWith`, `endsWith`, `truthy`, `falsy`.
- Entradas: `value`.
- Salidas: `output1..outputN`.
- Activacion: `EXISTS`.
- Sticky: no.
- Distribucion: local.
- Nota: si ninguna condicion coincide, descarta el token (sin salida).

### 4.4 `conditional`

- Funcion: evalua formulas y emite token de salida (`outputToken`) de la primera verdadera.
- Config: `inputs[]` (labels/variables), `conditions[]` (formula + token).
- Entradas: dinamicas `input1..inputN`.
- Salidas: `output` (token string o `undefined`).
- Activacion:
- `EXISTS` en entradas conectadas.
- `DONT_CARE` en entradas no conectadas.
- Sticky: no.
- Distribucion: local.

### 4.5 `selector`

- Funcion: selecciona entre dos valores segun condicion booleana.
- Entradas: `condition`, `trueValue`, `falseValue`.
- Salidas: `output`.
- Activacion:
- `condition` siempre `EXISTS`.
- `trueValue`/`falseValue` con `EXISTS` si conectados, `DONT_CARE` si no.
- Sticky: no.
- Distribucion: local.

### 4.6 `conditionalSelector`

- Funcion: selector por token (companion de `conditional`).
- Entradas: `token`, `input1..inputN`.
- Salidas: `output1..outputN` (mas `output` de compatibilidad legacy).
- Activacion:
- `token` `EXISTS`.
- Inputs segun conexion (`EXISTS`/`DONT_CARE`).
- Sticky: no.
- Distribucion: local.

### 4.7 `desvio`

- Funcion: enruta `value` a `output1` (condicion verdadera) o `output2` (falsa).
- Entradas: `value`, `condition`.
- Salidas: `output1`, `output2`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si (`value`, `condition`).
- Distribucion: local.

### 4.8 `relevo`

- Funcion: consume `value`, pero emite siempre `relay`.
- Entradas: `value`, `relay`.
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si (`value`, `relay`).
- Distribucion: local.

### 4.9 `while`

- Funcion: lazo controlado por condicion con intervalo.
- Entradas: `flow`, `condition`, `interval` (segundos).
- Salidas: `output`, `loopFlowOut`, `loopConditionOut`, `loopIntervalOut`.
- Activacion: `EXISTS`, `EXISTS`, `EXISTS`.
- Sticky: no.
- Distribucion: local.
- Nota: la primera iteracion en condicion verdadera pasa sin esperar; siguientes aplican delay.

---

## 5. Nodos de Listas

### 5.1 Generacion de secuencias

#### `sequence`

- Funcion: genera lista numerica `[start..end]` con `step`.
- Entradas: `start`, `end`, `step`.
- Salidas: `output`.
- Activacion: por puerto, `EXISTS` si conectado y `DONT_CARE` si no.
- Sticky: no.
- Distribucion: local, controller.

#### `pulseSequence`

- Funcion: igual que `sequence`, pero emite un token por elemento.
- Entradas: `start`, `end`, `step`.
- Salidas: `output` (multiples tokens).
- Activacion: igual que `sequence`.
- Sticky: no.
- Distribucion: local, controller.

### 5.2 Transformacion/combinacion basica

#### `zip`

- Entradas: `listA`, `listB`.
- Salidas: `output` (tuplas).
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.

#### `unzip`

- Entradas: `inputList` (lista de tuplas).
- Salidas: `listA`, `listB`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`).
- Distribucion: local, controller, micro:bit.

#### `filter`

- Funcion: filtra por subflujo predicado (o fallback truthy).
- Entradas: `inputList`, `context1..contextN`.
- Salidas: `outputList`.
- Activacion: todas `EXISTS`.
- Sticky: si (todas las entradas).
- Distribucion: local, controller, micro:bit.

#### `map`

- Funcion: mapea por subflujo transformador (o identidad fallback).
- Entradas: `inputList`, `context1..contextN`.
- Salidas: `outputList`.
- Activacion: todas `EXISTS`.
- Sticky: si (todas las entradas).
- Distribucion: local, controller, micro:bit.

### 5.3 Reduccion y agregados

#### `accumulate`

- Funcion: reduce por suma (acumulador inicial 0).
- Entradas: `inputList`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`).
- Distribucion: local, controller, micro:bit.

#### `product`

- Funcion: reduce por multiplicacion (inicial 1).
- Entradas: `inputList`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto; local sin sticky explicito.
- Distribucion: local, controller.
- Nota: no soportado en micro:bit (lanza error).

#### `count`

- Funcion: longitud de lista.
- Entradas: `inputList`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.

#### `sortList`

- Funcion: ordena asc/desc; numerico si todos son numeros finitos, si no lexicografico.
- Config: `order` (`asc`/`desc`).
- Entradas: `inputList`.
- Salidas: `outputList`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.

### 5.4 Operaciones sobre elementos

#### `listFirst`

- Funcion: primer elemento.
- Entradas: `inputList`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.
- Nota: error si lista vacia.

#### `listLast`

- Funcion: ultimo elemento.
- Entradas: `inputList`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.
- Nota: error si lista vacia.

#### `listMin`

- Funcion: minimo numerico.
- Entradas: `inputList`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.
- Nota: lista vacia retorna 0.

#### `listMax`

- Funcion: maximo numerico.
- Entradas: `inputList`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.
- Nota: lista vacia retorna 0.

#### `listFrequency`

- Funcion: cuenta ocurrencias y devuelve pares `[valor, frecuencia]`.
- Entradas: `inputList`.
- Salidas: `outputList`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.

#### `listAtPosition`

- Funcion: devuelve elemento en posicion 1-based.
- Entradas: `inputList`, `position`.
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.

#### `listFindElement`

- Funcion: devuelve primera posicion 1-based de `item`; 0 si no existe.
- Entradas: `inputList`, `item`.
- Salidas: `output`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.

#### `listRemoveFirst`

- Funcion: quita primer elemento.
- Entradas: `inputList`.
- Salidas: `outputList`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.

#### `listRemoveLast`

- Funcion: quita ultimo elemento.
- Entradas: `inputList`.
- Salidas: `outputList`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.

#### `listPrepend`

- Funcion: agrega `item` al inicio.
- Entradas: `inputList`, `item`.
- Salidas: `outputList`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.

#### `listAppend`

- Funcion: agrega `item` al final.
- Entradas: `inputList`, `item`.
- Salidas: `outputList`.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: local, controller, micro:bit.

#### `listIsEmpty`

- Funcion: indica si lista esta vacia.
- Entradas: `inputList`.
- Salidas: `output`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.

#### `listReverse`

- Funcion: invierte lista.
- Entradas: `inputList`.
- Salidas: `outputList`.
- Activacion: `EXISTS`.
- Sticky: si (`inputList`) en remoto.
- Distribucion: local, controller, micro:bit.

#### `splitList`

- Funcion: separa texto en caracteres o numero entero no negativo en digitos.
- Entradas: `inputValue`.
- Salidas: `outputList`.
- Activacion: `EXISTS`.
- Sticky: no.
- Distribucion: local.

#### `listEvenPositions`

- Funcion: filtra posiciones pares (1-based).
- Entradas: `inputList`.
- Salidas: `outputList`.
- Activacion: `EXISTS`.
- Sticky: no.
- Distribucion: local.

#### `listOddPositions`

- Funcion: filtra posiciones impares (1-based).
- Entradas: `inputList`.
- Salidas: `outputList`.
- Activacion: `EXISTS`.
- Sticky: no.
- Distribucion: local.

Alias legacy:

- `listParityPositions` se resuelve como `listEvenPositions`.

---

## 6. Nodos de Distribucion de Datos

### 6.1 `scatter`

- Funcion: divide `inputList` en `output1..outputN` (chunks balanceados).
- Entradas: `inputList`.
- Salidas: dinamicas `output1..outputN`.
- Activacion: `EXISTS`.
- Sticky: no.
- Distribucion: local, controller.

### 6.2 `gather`

- Funcion: concatena `input1..inputN` en `outputList` (aplana arrays una capa).
- Entradas: dinamicas `input1..inputN`.
- Salidas: `outputList`.
- Activacion:
- por entrada, `EXISTS` si conectada, `DONT_CARE` si no.
- Sticky: no.
- Distribucion: local, controller.

---

## 7. Nodos de Salida

### 7.1 `write`

- Funcion: envia datos al observador/consola del motor.
- Entradas: dinamicas `input1..inputN`.
- Salidas: ninguna.
- Activacion:
- puertos conectados `EXISTS`, no conectados `DONT_CARE`.
- Sticky: no.
- Distribucion: local.

### 7.2 `microbitWrite`

- Funcion: escribe texto en display micro:bit (`TXT:`).
- Entradas: `input1`.
- Salidas: ninguna.
- Activacion: `EXISTS`.
- Sticky: no.
- Distribucion: micro:bit.

### 7.3 `microbitSound`

- Funcion: reproduce sonido (`SND:frecuencia,duracionMs`).
- Entradas: `input1` (frecuencia), `input2` (duracion).
- Salidas: ninguna.
- Activacion: `EXISTS`, `EXISTS`.
- Sticky: si.
- Distribucion: micro:bit.

### 7.4 `microbitWritePin`

- Funcion: escribe en pin (`PINW:pin,mode,value`).
- Entradas: `input1`.
- Salidas: ninguna.
- Activacion: `EXISTS`.
- Sticky: no.
- Distribucion: micro:bit.

---

## 8. Nodos de Abstraccion y Reutilizacion

### 8.1 `subflow`

- Funcion: encapsula un grafo reusable con `N` entradas y `M` salidas.
- Entradas: `input1..inputN`.
- Salidas: `output1..outputM`.
- Activacion: todas `EXISTS`.
- Sticky: no.
- Distribucion: local, controller, micro:bit.
- Notas:
- soporta template embebido o resolucion por `templateId`.
- soporta recursion cuando invoca su misma plantilla.

### 8.2 `replicateFlow`

- Funcion: ejecuta un mismo subflujo en multiples destinos (local/controller/micro:bit) y agrega resultados por salida.
- Entradas: tipicamente `input1..inputR` (una por replica cuando aplica).
- Salidas: `output1..outputR`.
- Activacion:
- `EXISTS` por replica que requiere input.
- sin entradas si el subflujo no requiere argumentos.
- Sticky: no.
- Distribucion: orquestador local con replicas locales/remotas.

### 8.3 Nodos internos de subflujo

#### `subflowInput`

- Funcion: passthrough de entrada interna.
- Entradas: `input`.
- Salidas: `output`.
- Activacion: `EXISTS`.

#### `subflowOutput`

- Funcion: passthrough de salida interna.
- Entradas: `input`.
- Salidas: `output`.
- Activacion: `EXISTS`.

#### `filterInputValue`, `mapInputValue`, `replicateInputValue`

- Funcion: inyectan valor de item/contexto en subeditores internos.
- Entradas: `input`.
- Salidas: `output`.
- Activacion: `EXISTS`.

#### `filterBooleanOutput`

- Funcion: nodo interno de salida booleana para predicados.
- Entradas: `input`.
- Salidas: `output`.
- Activacion: `EXISTS`.

---

## 9. Macro y Nodos Solo UI

### 9.1 `conditionalPair` (macro de paleta)

- No se ejecuta como tipo unico en motor.
- Al arrastrar, crea:
- un nodo `conditional`.
- un nodo `conditionalSelector`.
- una arista bloqueada que conecta `conditional.out -> conditionalSelector.token`.

### 9.2 `comment`

- Nodo de anotacion visual.
- No participa en compilacion al motor.

### 9.3 `baseNode`

- Tipo base de UI.
- No representa operacion ejecutable por si misma.

---

## 10. Resumen de Soporte por Destino

| Nodo / Grupo | Local | Controller | micro:bit |
|---|:---:|:---:|:---:|
| `constantInput`, `constantNumber`, `constantBoolean`, `constantText`, `constantList`, `runtimeInput`, `randomInput`, `choiceInput`, `timerInput` | Si | No | No |
| `microbitReadButton`, `microbitReadTemperature`, `microbitReadPin` | No | No | Si |
| `sum`, `subtract`, `multiply`, `divide`, `mod`, `power`, `mathOperation`, `root`, `logarithm`, `floor`, `ceiling`, `round`, `concat`, `replaceText`, `subtractText`, `sliceText` | Si | Si | Si |
| `formulaEditor` | Si | No | No |
| `comparison*`, `and`, `nand`, `or`, `nor`, `xor`, `not`, `logicOperation` | Si | No | Si |
| `switch`, `conditional`, `selector`, `conditionalSelector`, `desvio`, `relevo`, `while` | Si | No | No |
| `sequence`, `pulseSequence` | Si | Si | No |
| `zip`, `unzip`, `filter`, `map`, `accumulate`, `count`, `sortList`, `listFirst`, `listLast`, `listMin`, `listMax`, `listFrequency`, `listAtPosition`, `listFindElement`, `listRemoveFirst`, `listRemoveLast`, `listPrepend`, `listAppend`, `listIsEmpty`, `listReverse` | Si | Si | Si |
| `product` | Si | Si | No |
| `splitList`, `listEvenPositions`, `listOddPositions` | Si | No | No |
| `scatter`, `gather` | Si | Si | No |
| `write` | Si | No | No |
| `microbitWrite`, `microbitSound`, `microbitWritePin` | No | No | Si |
| `subflow` | Si | Si | Si |
| `replicateFlow` | Si | Si (por replica) | Si (por replica) |

---

## 11. Resumen del Lenguaje (Estado Actual)

1. Entrada de datos: constantes tipadas, entrada en runtime, aleatoriedad, temporizacion y sensores micro:bit.
2. Calculo: aritmetica binaria/unaria, formulas, texto y operadores configurables.
3. Logica y control: comparacion, compuertas, switch multicondicion, par condicional-selector, desvio/relevo/while.
4. Colecciones: secuencias, map/filter con subflujo, agregados, transformaciones e indexacion.
5. Paralelismo de datos: scatter/gather.
6. Salidas: consola local y actuadores micro:bit.
7. Abstraccion: subflujos reutilizables, recursion y replicacion multi-destino.
