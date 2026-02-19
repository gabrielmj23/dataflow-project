# Catálogo de Nodos del Lenguaje Dataflow

Este documento describe todos los nodos disponibles en el lenguaje visual de programación dataflow, organizados por categoría. Cada nodo incluye su descripción funcional, puertos de entrada/salida, patrón de activación y capacidades de distribución.

---

## Conceptos Previos

### Patrones de Activación (Fire Patterns)

Cada puerto de entrada tiene un patrón que determina cuándo el nodo se activa:

| Patrón       | Comportamiento |
|--------------|----------------|
| `EXISTS`     | Requiere un token presente en el puerto para activarse. |
| `DONT_CARE`  | El nodo se activa independientemente de si hay dato en ese puerto (usa valor por defecto). |
| `ALWAYS`     | El nodo se activa en cada paso de ejecución sin necesidad de entrada externa. |

### Puertos Sticky

Algunos puertos son "sticky": retienen el último valor recibido y lo reutilizan en ejecuciones posteriores si no llega un nuevo token. Esto permite que un nodo se reactive con una sola entrada nueva mientras las demás conservan sus valores previos.

### Destinos de Ejecución (Distribution)

Muchos nodos soportan ejecución distribuida mediante el campo `executionTarget`:

| Destino        | Descripción |
|----------------|-------------|
| **local**      | Ejecución en el navegador (por defecto). |
| **controller** | Ejecución remota delegada a un controlador externo vía WebSocket. |
| **micro:bit**  | Ejecución en un dispositivo micro:bit conectado por serial o Bluetooth. |

---

## 1. Nodos de Entrada

Generan datos iniciales que alimentan el flujo. Todos tienen un único puerto de salida (`output`) y se activan con patrón `ALWAYS` (emiten su valor en cada paso).

### 1.1 Constante Genérica (`constantInput`)

- **Función:** Emite un valor constante (número, texto o booleano) configurado por el usuario.
- **Salidas:** `output` — el valor constante.
- **Activación:** `ALWAYS`.

### 1.2 Constante Numérica (`constantNumber`)

- **Función:** Emite un valor numérico constante.
- **Salidas:** `output` — número.
- **Activación:** `ALWAYS`.

### 1.3 Constante Booleana (`constantBoolean`)

- **Función:** Emite `true` o `false`.
- **Salidas:** `output` — booleano.
- **Activación:** `ALWAYS`.

### 1.4 Constante de Texto (`constantText`)

- **Función:** Emite una cadena de texto constante.
- **Salidas:** `output` — string.
- **Activación:** `ALWAYS`.

### 1.5 Constante de Lista (`constantList`)

- **Función:** Emite un arreglo de valores (números y/o strings) definidos por el usuario.
- **Salidas:** `output` — array.
- **Activación:** `ALWAYS`.

### 1.6 Entrada en Tiempo de Ejecución (`runtimeInput`)

- **Función:** Solicita un valor al usuario durante la ejecución del programa. Puede configurarse como numérico o de texto, con un mensaje de prompt y valor por defecto opcionales.
- **Salidas:** `output` — el valor ingresado (o el valor por defecto).
- **Activación:** `ALWAYS`.

### 1.7 Número Aleatorio (`randomInput`)

- **Función:** Genera un número aleatorio en un rango `[min, max]`. Opcionalmente solo genera enteros.
- **Configuración:** `min`, `max`, `integerOnly`.
- **Salidas:** `output` — número aleatorio.
- **Activación:** `ALWAYS`.

### 1.8 Selección Aleatoria (`choiceInput`)

- **Función:** Selecciona aleatoriamente un elemento de una lista de opciones predefinidas (strings).
- **Configuración:** `choices` — lista de opciones.
- **Salidas:** `output` — la opción seleccionada.
- **Activación:** `ALWAYS`.

### 1.9 Temporizador (`timerInput`)

- **Función:** Introduce un retraso temporal en el flujo. Opera en dos modos:
  - **source:** Se activa automáticamente (`DONT_CARE`) y emite tras el intervalo.
  - **delay:** Requiere un token entrante (`EXISTS`), aplica el retraso y reenvía el valor.
- **Configuración:** `timeValue` (segundos).
- **Entradas:** `input` (solo en modo delay).
- **Salidas:** `output` — el valor recibido (o `0` en modo source).
- **Activación:** `EXISTS` (delay) o `DONT_CARE` (source).

### 1.10 Lectura de Botón micro:bit (`microbitReadButton`)

- **Función:** Lee el estado de un botón del dispositivo micro:bit.
- **Configuración:** `transport` (serial/bluetooth).
- **Salidas:** `output` — estado del botón.
- **Distribución:** Solo micro:bit.

---

## 2. Nodos de Procesamiento Aritmético

Realizan operaciones matemáticas. Todos tienen puertos sticky (retienen valores).

### 2.1 Suma (`sum`)

- **Entradas:** `input1` (número), `input2` (número).
- **Salida:** `output` — `input1 + input2`.
- **Activación:** Ambas `EXISTS` (sticky).
- **Distribución:** local, controller, micro:bit.

### 2.2 Resta (`subtract`)

- **Entradas:** `input1`, `input2`.
- **Salida:** `output` — `input1 - input2`.
- **Activación/Distribución:** Igual que Suma.

### 2.3 Multiplicación (`multiply`)

- **Entradas:** `input1`, `input2`.
- **Salida:** `output` — `input1 * input2`.
- **Activación/Distribución:** Igual que Suma.

### 2.4 División (`divide`)

- **Entradas:** `input1`, `input2`.
- **Salida:** `output` — `input1 / input2`. Lanza error si el resultado no es finito (división por cero).
- **Activación/Distribución:** Igual que Suma.

### 2.5 Módulo (`mod`)

- **Entradas:** `input1`, `input2`.
- **Salida:** `output` — `input1 % input2`.
- **Activación/Distribución:** Igual que Suma.

### 2.6 Potencia (`power`)

- **Entradas:** `input1` (base), `input2` (exponente).
- **Salida:** `output` — `input1 ^ input2`. Lanza error para `0^0` y resultados no finitos.
- **Activación/Distribución:** Igual que Suma.

### 2.7 Piso (`floor`)

- **Entradas:** `input1` (número).
- **Salida:** `output` — `⌊input1⌋`.
- **Activación:** `EXISTS` (sticky).
- **Distribución:** local, controller, micro:bit.

### 2.8 Techo (`ceiling`)

- **Entradas:** `input1` (número).
- **Salida:** `output` — `⌈input1⌉`.
- **Activación/Distribución:** Igual que Piso.

### 2.9 Redondeo (`round`)

- **Entradas:** `input1` (número).
- **Salida:** `output` — redondeo al entero más cercano.
- **Activación/Distribución:** Igual que Piso.

### 2.10 Editor de Fórmulas (`formulaEditor`)

- **Función:** Evalúa una expresión matemática arbitraria escrita por el usuario. Las variables de la fórmula se mapean a puertos de entrada dinámicos.
- **Configuración:** `formula` (expresión como `"a * b + 2"`), `variables` (lista de nombres de variables).
- **Entradas:** Un puerto `inputN` por cada variable (todas `EXISTS`, sticky).
- **Salida:** `output` — resultado numérico de la fórmula evaluada.
- **Distribución:** Solo local.

---

## 3. Nodos de Procesamiento de Texto

Operan sobre cadenas de texto. Todos tienen puertos sticky.

### 3.1 Concatenar (`concat`)

- **Entradas:** `input1` (texto), `input2` (texto).
- **Salida:** `output` — `input1 + input2` (concatenación).
- **Activación:** Ambas `EXISTS` (sticky).
- **Distribución:** local, controller, micro:bit.

### 3.2 Reemplazar Texto (`replaceText`)

- **Entradas:** `text` (fuente), `search` (texto a buscar), `replacement` (reemplazo).
- **Salida:** `output` — texto con todas las ocurrencias de `search` reemplazadas por `replacement`.
- **Activación:** Todas `EXISTS` (sticky).
- **Distribución:** Solo local.

### 3.3 Sustraer Texto (`subtractText`)

- **Entradas:** `text` (fuente), `search` (texto a eliminar).
- **Salida:** `output` — texto con todas las ocurrencias de `search` eliminadas.
- **Activación:** Ambas `EXISTS` (sticky).
- **Distribución:** Solo local.

### 3.4 Extraer Subcadena (`sliceText`)

- **Entradas:** `text` (fuente), `start` (índice inicio), `end` (índice fin, inclusivo).
- **Salida:** `output` — subcadena desde `start` hasta `end`.
- **Activación:** Todas `EXISTS` (sticky).
- **Distribución:** Solo local.

---

## 4. Nodos de Lógica y Control de Flujo

### 4.1 Comparación (`comparison`)

- **Función:** Compara dos valores con un operador configurable.
- **Operadores:** `==`, `!=`, `<`, `<=`, `>`, `>=`.
- **Entradas:** `input1`, `input2` (sticky).
- **Salida:** `output` — booleano.
- **Distribución:** local, micro:bit.

### 4.2 Compuertas Lógicas

Todas siguen la misma estructura: dos entradas booleanas (sticky), una salida booleana. Distribución: local, micro:bit.

| Nodo            | ID     | Operación          |
|-----------------|--------|--------------------|
| **AND**         | `and`  | `a && b`           |
| **NAND**        | `nand` | `!(a && b)`        |
| **OR**          | `or`   | `a \|\| b`         |
| **NOR**         | `nor`  | `!(a \|\| b)`      |
| **XOR**         | `xor`  | `a !== b`          |

### 4.3 NOT (`not`)

- **Entradas:** `input` — booleano (sticky).
- **Salida:** `output` — negación lógica.
- **Distribución:** local, micro:bit.

### 4.4 Switch (`switch`)

- **Función:** Enrutador condicional. Evalúa un valor de entrada contra N condiciones ordenadas y emite el valor por el primer puerto cuya condición se cumple. Si ninguna coincide, el token se descarta.
- **Operadores de condición:** `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `startsWith`, `endsWith`, `truthy`, `falsy`.
- **Entradas:** `value`.
- **Salidas:** `output1`, `output2`, ..., `outputN` (una por condición).
- **Activación:** `EXISTS`.
- **Distribución:** Solo local.

### 4.5 Condicional (`conditional`)

- **Función:** Evalúa N fórmulas matemáticas sobre las entradas y emite un token de texto ("Salida 1", "Salida 2", etc.) correspondiente a la primera fórmula que resulte verdadera.
- **Configuración:** Entradas con etiquetas (variables de fórmula), condiciones con fórmulas y tokens de salida.
- **Entradas:** `input1`, ..., `inputN` (dinámicas, basadas en etiquetas).
- **Salida:** `output` — string con el nombre del token ganador (o `undefined`).
- **Activación:** `EXISTS` para puertos con conexión entrante, `DONT_CARE` para los demás.
- **Distribución:** Solo local.

### 4.6 Selector (`selector`)

- **Función:** Recibe un token de texto y múltiples valores; emite el valor correspondiente al token que coincide.
- **Entradas:** `token` (string), más un puerto por cada opción (ej. `"Salida 1"`, `"Salida 2"`).
- **Salida:** `output` — el valor seleccionado.
- **Activación:** `token` es `EXISTS`; las opciones son `EXISTS` si tienen conexión entrante, `DONT_CARE` si no.
- **Distribución:** Solo local.

> **Nota:** Switch, Conditional y Selector se complementan para implementar ramificación condicional completa: Switch para enrutar un valor, Conditional para evaluar expresiones y emitir un token de decisión, y Selector para elegir un valor según ese token.

---

## 5. Nodos de Listas y Colecciones

### 5.1 Generar Secuencia (`sequence`)

- **Función:** Genera un arreglo `[start, start+step, ..., end]`.
- **Entradas:** `start`, `end`, `step` (todas opcionales; usan defaults 1, 10, 1).
- **Salida:** `output` — array de números.
- **Activación:** `EXISTS` si el puerto tiene conexión, `DONT_CARE` si no.
- **Distribución:** Solo local.

### 5.2 Secuencia por Pulsos (`pulseSequence`)

- **Función:** Igual que Generar Secuencia, pero en vez de emitir un solo array, emite cada elemento como un DataToken individual (múltiples tokens de salida en una sola activación).
- **Entradas/Salidas/Activación:** Igual que Generar Secuencia.
- **Distribución:** Solo local.

> **Nota:** `sequence` emite la lista completa como un solo valor; `pulseSequence` emite cada elemento individualmente, permitiendo procesamiento elemento-a-elemento downstream.

### 5.3 Filter (`filter`)

- **Función:** Filtra una lista según un predicado definido como un subgrafo interno. Cada elemento se pasa al subgrafo y se conserva solo si el resultado es truthy.
- **Entradas:** `inputList` — array.
- **Salida:** `outputList` — array filtrado.
- **Activación:** `EXISTS` (sticky).
- **Distribución:** local, micro:bit.

### 5.4 Map (`map`)

- **Función:** Transforma cada elemento de una lista usando un subgrafo interno (función de transformación).
- **Entradas:** `inputList` — array.
- **Salida:** `outputList` — array transformado.
- **Activación:** `EXISTS` (sticky).
- **Distribución:** local, micro:bit.

### 5.5 Reduce / Acumular (`accumulate`)

- **Función:** Reduce una lista a un solo valor aplicando una operación acumulativa (suma por defecto, acumulador inicial = 0).
- **Entradas:** `inputList` — array de números.
- **Salida:** `output` — número acumulado.
- **Activación:** `EXISTS`.
- **Distribución:** local, micro:bit.

### 5.6 Contar (`count`)

- **Función:** Retorna la longitud de una lista.
- **Entradas:** `inputList` — array.
- **Salida:** `output` — número (longitud).
- **Activación:** `EXISTS`.
- **Distribución:** local, micro:bit.

### 5.7 Ordenar (`sortList`)

- **Función:** Ordena una lista. Si todos los elementos son numéricos, ordena numéricamente; de lo contrario, ordena lexicográficamente.
- **Configuración:** `order` — `"asc"` (ascendente) o `"desc"` (descendente).
- **Entradas:** `inputList` — array.
- **Salida:** `outputList` — array ordenado.
- **Activación:** `EXISTS`.
- **Distribución:** local, micro:bit.

### 5.8 Zip (`zip`)

- **Función:** Combina dos listas en una lista de tuplas `[a, b]`, truncando a la longitud de la más corta.
- **Entradas:** `listA`, `listB` — arrays.
- **Salida:** `output` — array de tuplas.
- **Activación:** Ambas `EXISTS` (sticky).
- **Distribución:** local, micro:bit.

### 5.9 Unzip (`unzip`)

- **Función:** Separa una lista de tuplas `[a, b]` en dos listas independientes.
- **Entradas:** `inputList` — array de tuplas.
- **Salidas:** `listA`, `listB` — los dos arrays resultantes (emitidos como DataTokens dirigidos).
- **Activación:** `EXISTS`.
- **Distribución:** local, micro:bit.

### 5.10 Scatter (`scatter`)

- **Función:** Distribuye una lista entre N puertos de salida, dividiendo los elementos en chunks lo más equitativos posible.
- **Configuración:** Número de salidas (inferido de conexiones).
- **Entradas:** `inputList` — array.
- **Salidas:** `output1`, ..., `outputN` — sublistas (emitidas como DataTokens dirigidos).
- **Activación:** `EXISTS`.
- **Distribución:** Solo local.

### 5.11 Gather (`gather`)

- **Función:** Reúne valores de N puertos de entrada en una sola lista. Si un valor ya es un array, sus elementos se aplastan al nivel superior.
- **Configuración:** Número de entradas (inferido de conexiones).
- **Entradas:** `input1`, ..., `inputN`.
- **Salida:** `outputList` — array concatenado.
- **Activación:** `EXISTS` para puertos con conexión, `DONT_CARE` para los demás.
- **Distribución:** Solo local.

> **Nota:** Scatter y Gather forman un par complementario para paralelismo de datos: Scatter divide el trabajo y Gather recoge los resultados.

---

## 6. Nodos de Salida

### 6.1 Escribir (`write`)

- **Función:** Muestra valores al usuario a través del observador del motor. Acepta N entradas (dinámico según conexiones) y opcionalmente un template de formato.
- **Entradas:** `input1`, ..., `inputN` (todas `EXISTS`, sticky).
- **Salida:** Ninguna (nodo sumidero).
- **Distribución:** Solo local.

### 6.2 Escribir en micro:bit (`microbitWrite`)

- **Función:** Envía un valor para mostrarlo en la pantalla LED del micro:bit.
- **Configuración:** `transport` (serial/bluetooth).
- **Distribución:** Solo micro:bit.

### 6.3 Sonido micro:bit (`microbitSound`)

- **Función:** Reproduce un sonido en el micro:bit.
- **Configuración:** `transport` (serial/bluetooth).
- **Distribución:** Solo micro:bit.

---

## 7. Nodos de Abstracción (Subflow)

### 7.1 Subflow (`subflow`)

- **Función:** Encapsula un subgrafo completo como una unidad reutilizable. Actúa como una "función" del lenguaje: recibe N entradas, ejecuta internamente un grafo de nodos, y produce M salidas.
- **Configuración:** `templateId` (referencia a plantilla guardada), `inCount`, `outCount`, nodos y arcos internos.
- **Entradas:** `input1`, ..., `inputN`.
- **Salidas:** `output1`, ..., `outputM`.
- **Activación:** Todas `EXISTS`.
- **Distribución:** local, controller, micro:bit.
- **Recursión:** Soporta invocación recursiva detectando cuando el templateId coincide con el subflow actual.

### 7.2 Entrada de Subflow (`subflowInput`)

- **Función:** Nodo interno que marca un punto de entrada dentro de un subflow. Actúa como pass-through.
- **Puertos:** `input` → `output`.
- **Activación:** `EXISTS`.

### 7.3 Salida de Subflow (`subflowOutput`)

- **Función:** Nodo interno que marca un punto de salida dentro de un subflow. Actúa como pass-through.
- **Puertos:** `input` → `output`.
- **Activación:** `EXISTS`.

### 7.4 Entrada de Valor para Filter/Map (`filterInputValue`, `mapInputValue`)

- **Función:** Nodos internos usados dentro de los subgrafos de Filter y Map para inyectar el elemento actual de la iteración.
- **Puertos:** `input` → `output`.
- **Activación:** `EXISTS`.

---

## Resumen de Distribución por Nodo

| Categoría | Nodo | Local | Controller | micro:bit |
|-----------|------|:-----:|:----------:|:---------:|
| **Entrada** | constantInput, constantNumber, constantBoolean, constantText, constantList | Si | — | — |
| | runtimeInput, randomInput, choiceInput | Si | — | — |
| | timerInput | Si | — | — |
| | microbitReadButton | — | — | Si |
| **Aritmética** | sum, subtract, multiply, divide, mod, power | Si | Si | Si |
| | floor, ceiling, round | Si | Si | Si |
| | formulaEditor | Si | — | — |
| **Texto** | concat | Si | Si | Si |
| | replaceText, subtractText, sliceText | Si | — | — |
| **Lógica** | comparison | Si | — | Si |
| | and, nand, or, nor, xor, not | Si | — | Si |
| | switch, conditional, selector | Si | — | — |
| **Listas** | sequence, pulseSequence | Si | — | — |
| | filter, map | Si | — | Si |
| | accumulate, count, sortList | Si | — | Si |
| | zip, unzip | Si | — | Si |
| | scatter, gather | Si | — | — |
| **Salida** | write | Si | — | — |
| | microbitWrite, microbitSound | — | — | Si |
| **Abstracción** | subflow | Si | Si | Si |

---

## Resumen de Capacidades del Lenguaje

1. **Aritmética completa:** Operaciones binarias (+, -, *, /, %, ^) y unarias (floor, ceil, round), además de un editor de fórmulas con expresiones arbitrarias.
2. **Manipulación de texto:** Concatenación, reemplazo, sustracción y extracción de subcadenas.
3. **Lógica booleana:** Compuertas completas (AND, NAND, OR, NOR, XOR, NOT) y comparadores.
4. **Control de flujo:** Switch multi-condición, evaluador condicional con fórmulas, y selector basado en tokens.
5. **Colecciones:** Generación de secuencias, filter, map, reduce, count, sort, zip/unzip.
6. **Paralelismo de datos:** Scatter/Gather para dividir y reunir listas.
7. **Abstracción:** Subflows reutilizables y recursivos que actúan como funciones parametrizadas.
8. **Interacción:** Entrada del usuario en tiempo de ejecución, temporizadores, y generación aleatoria.
9. **Distribución:** Ejecución local, en controlador remoto o en hardware micro:bit.
