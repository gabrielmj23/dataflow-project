export type NodePaletteItem = {
  type: string;
  label: string;
  description?: string;
  /**
   * Identificador de plantilla para subflujos guardados.
   * Cuando está presente, el ítem representa un subflujo definido por el usuario
   * y no un nodo "built-in".
   */
  templateId?: string;
};

export type NodePaletteCategory = {
  id: string;
  title: string;
  items: NodePaletteItem[];
};

export type AbstractionLevel = 1 | 2 | 3;

const nodeAbstractionLevelMap: Record<string, AbstractionLevel> = {
  runtimeInput: 1,
  constantNumber: 1,
  constantBoolean: 1,
  constantText: 1,
  constantList: 3,
  timerInput: 2,
  randomInput: 2,
  choiceInput: 2,
  microbitReadButton: 3,
  microbitReadTemperature: 3,

  sum: 1,
  subtract: 1,
  multiply: 1,
  divide: 1,
  mod: 1,
  power: 1,
  mathOperation: 2,
  root: 1,
  logarithm: 1,
  floor: 1,
  ceiling: 1,
  round: 1,
  formulaEditor: 3,

  concat: 1,
  replaceText: 1,
  subtractText: 1,
  sliceText: 1,

  comparison: 1,
  comparisonEqual: 1,
  comparisonNotEqual: 1,
  comparisonLess: 1,
  comparisonLessOrEqual: 1,
  comparisonGreater: 1,
  comparisonGreaterOrEqual: 1,
  and: 1,
  nand: 1,
  or: 1,
  nor: 1,
  xor: 1,
  not: 1,
  desvio: 2,
  switch: 2,
  selector: 2,
  conditional: 3,
  conditionalPair: 3,
  scatter: 2,
  gather: 2,

  sequence: 3,
  pulseSequence: 2,
  zip: 3,
  unzip: 3,
  filter: 3,
  map: 3,
  sortList: 3,
  accumulate: 3,
  product: 3,
  count: 3,
  listFirst: 2,
  listLast: 2,
  listAtPosition: 2,
  listFindElement: 2,
  listRemoveFirst: 2,
  listRemoveLast: 2,
  listPrepend: 2,
  listAppend: 2,
  listIsEmpty: 2,
  listReverse: 2,
  splitList: 2,
  listEvenPositions: 2,
  listOddPositions: 2,

  subflow: 3,
  write: 1,
  microbitWrite: 3,
  microbitSound: 3,
};

export function getNodeAbstractionLevel(type: string): AbstractionLevel {
  return nodeAbstractionLevelMap[type] ?? 3;
}

export function getNodeDescription(type: string): string | undefined {
  for (const category of nodePalette) {
    for (const item of category.items) {
      if (item.type === type) return item.description;
    }
  }
  return undefined;
}

export const nodePalette: NodePaletteCategory[] = [
  {
    id: "inputs",
    title: "Entradas",
    items: [
      {
        type: "runtimeInput",
        label: "Leer",
        description:
          "Pausa la ejecución y solicita un número al usuario en tiempo real.",
      },
      {
        type: "constantNumber",
        label: "Número",
        description: "Emite siempre el mismo número configurado.",
      },
      {
        type: "constantBoolean",
        label: "Valor Lógico",
        description: "Emite siempre el mismo valor verdadero/falso.",
      },
      {
        type: "constantText",
        label: "Texto",
        description: "Emite siempre el mismo texto configurado.",
      },
      {
        type: "constantList",
        label: "Lista fija",
        description: "Crea una lista fija de números o textos.",
      },
      {
        type: "timerInput",
        label: "Temporizador",
        description: "Detiene la ejecución por un tiempo definido.",
      },
      {
        type: "randomInput",
        label: "Valor aleatorio",
        description: "Genera valores aleatorios dentro de un rango.",
      },
      {
        type: "choiceInput",
        label: "Selección aleatoria",
        description:
          "Elige un elemento aleatorio de una lista de opciones configurables.",
      },
      {
        type: "pulseSequence",
        label: "Generar pulsos",
        description:
          "Genera una secuencia de números como pulsos individuales.",
      },
    ],
  },
  {
    id: "io",
    title: "Salidas",
    items: [
      {
        type: "write",
        label: "Escribir",
        description: "Muestra valores para inspeccionarlos o imprimirlos.",
      },
    ],
  },
  {
    id: "math",
    title: "Matemática",
    items: [
      {
        type: "sum",
        label: "Sumar",
        description: "Suma dos valores numéricos.",
      },
      {
        type: "subtract",
        label: "Restar",
        description: "Resta el segundo valor del primero.",
      },
      {
        type: "multiply",
        label: "Multiplicar",
        description: "Multiplica dos valores numéricos.",
      },
      {
        type: "divide",
        label: "Dividir",
        description: "Divide el primer valor entre el segundo.",
      },
      {
        type: "mod",
        label: "Resto",
        description: "Calcula el resto de la división entre dos valores.",
      },
      {
        type: "power",
        label: "Potencia",
        description: "Eleva una base a un exponente.",
      },
      {
        type: "mathOperation",
        label: "Operación matemática",
        description:
          "Nodo rápido para elegir entre sumar, restar, multiplicar, dividir, resto o potencia.",
      },
      {
        type: "root",
        label: "Raíz",
        description: "Calcula la raíz n-ésima de un número.",
      },
      {
        type: "logarithm",
        label: "Logaritmo",
        description: "Calcula el logaritmo de un número en una base dada.",
      },
      {
        type: "floor",
        label: "Piso",
        description: "Redondea hacia abajo. Ejemplo: piso(3.7) → 3.",
      },
      {
        type: "ceiling",
        label: "Techo",
        description: "Redondea hacia arriba. Ejemplo: techo(3.1) → 4.",
      },
      {
        type: "round",
        label: "Redondear",
        description: "Redondea al entero más cercano.",
      },
      {
        type: "formulaEditor",
        label: "Editor de fórmulas",
        description: "Calcula una expresión con variables numéricas.",
      },
    ],
  },
  {
    id: "text",
    title: "Texto",
    items: [
      {
        type: "concat",
        label: "Concatenar",
        description: "Une dos cadenas o listas en una sola.",
      },
      {
        type: "replaceText",
        label: "Reemplazar",
        description: "Sustituye coincidencias de un texto por otro.",
      },
      {
        type: "subtractText",
        label: "Eliminar",
        description:
          "Elimina todas las ocurrencias de un fragmento en un texto.",
      },
      {
        type: "sliceText",
        label: "Recortar",
        description:
          "Devuelve un segmento del texto entre posición inicio y fin.",
      },
    ],
  },
  {
    id: "control",
    title: "Control y lógica",
    items: [
      {
        type: "comparison",
        label: "Comparación",
        description: "Compara dos valores con un operador (>, ==, etc.).",
      },
      {
        type: "comparisonEqual",
        label: "Igual",
        description: "Compara dos valores y devuelve verdadero si son iguales.",
      },
      {
        type: "comparisonNotEqual",
        label: "Distinto",
        description:
          "Compara dos valores y devuelve verdadero si son distintos.",
      },
      {
        type: "comparisonLess",
        label: "Menor",
        description:
          "Compara dos valores y devuelve verdadero si el primero es menor.",
      },
      {
        type: "comparisonLessOrEqual",
        label: "Menor o igual",
        description:
          "Compara dos valores y devuelve verdadero si el primero es menor o igual.",
      },
      {
        type: "comparisonGreater",
        label: "Mayor",
        description:
          "Compara dos valores y devuelve verdadero si el primero es mayor.",
      },
      {
        type: "comparisonGreaterOrEqual",
        label: "Mayor o igual",
        description:
          "Compara dos valores y devuelve verdadero si el primero es mayor o igual.",
      },
      {
        type: "and",
        label: "AND",
        description: "Devuelve verdadero si todas las entradas son verdaderas.",
      },
      {
        type: "nand",
        label: "NAND",
        description: "Verdadero salvo que todas las entradas sean verdaderas.",
      },
      {
        type: "or",
        label: "OR",
        description: "Devuelve verdadero si al menos una entrada es verdadera.",
      },
      {
        type: "nor",
        label: "NOR",
        description: "Verdadero solo cuando todas las entradas son falsas.",
      },
      {
        type: "xor",
        label: "XOR",
        description: "Verdadero si exactamente una entrada es verdadera.",
      },
      {
        type: "not",
        label: "NOT",
        description: "Niega un valor booleano de entrada.",
      },
      {
        type: "desvio",
        label: "Desvio",
        description:
          "Desvía el valor de entrada a la salida superior si la condición es verdadera, o a la inferior si es falsa.",
      },
      {
        type: "switch",
        label: "Switch",
        description: "Activa una de varias salidas según una condición.",
      },
      {
        type: "conditionalPair",
        label: "Condicional",
        description:
          "Condicional + Selector: evalúa reglas y entrega un valor según el token.",
      },
    ],
  },
  {
    id: "iteration",
    title: "Listas",
    items: [
      {
        type: "sequence",
        label: "Generar secuencia",
        description: "Genera una secuencia de números (ej. 0..N).",
      },
      {
        type: "zip",
        label: "Unir listas",
        description: "Combina listas elemento a elemento.",
      },
      {
        type: "unzip",
        label: "Separar lista",
        description:
          "Separa una lista de pares en dos listas (inverso de Zip).",
      },
      {
        type: "filter",
        label: "Filtrar",
        description: "Conserva solo los elementos que cumplen una condición.",
      },
      {
        type: "map",
        label: "Mapear",
        description:
          "Transforma cada elemento de una lista aplicando una función.",
      },
      {
        type: "sortList",
        label: "Ordenar lista",
        description:
          "Ordena una lista ascendente o descendente, numérica o alfabética.",
      },
      {
        type: "accumulate",
        label: "Acumular",
        description: "Suma los elementos de una lista.",
      },
      {
        type: "product",
        label: "Productorio",
        description: "Multiplica todos los elementos de una lista.",
      },
      {
        type: "count",
        label: "Contar",
        description: "Cuenta cuántos elementos hay en una lista.",
      },
      {
        type: "listFirst",
        label: "Primer elemento",
        description: "Extrae el primer elemento de una lista.",
      },
      {
        type: "listLast",
        label: "Último elemento",
        description: "Extrae el último elemento de una lista.",
      },
      {
        type: "listAtPosition",
        label: "Elemento en posición",
        description:
          "Obtiene el elemento en una posición indicada (empezando en 1).",
      },
      {
        type: "listFindElement",
        label: "Buscar elemento",
        description:
          "Devuelve la primera posición (desde 1) donde aparece un elemento; 0 si no aparece.",
      },
      {
        type: "listRemoveFirst",
        label: "Quitar el primero",
        description: "Devuelve la lista sin su primer elemento.",
      },
      {
        type: "listRemoveLast",
        label: "Quitar el último",
        description: "Devuelve la lista sin su último elemento.",
      },
      {
        type: "listPrepend",
        label: "Añadir al inicio",
        description: "Inserta un elemento al inicio de la lista.",
      },
      {
        type: "listAppend",
        label: "Añadir al final",
        description: "Inserta un elemento al final de la lista.",
      },
      {
        type: "listIsEmpty",
        label: "Lista vacía",
        description: "Devuelve verdadero si la lista no tiene elementos.",
      },
      {
        type: "listReverse",
        label: "Voltear",
        description: "Invierte el orden de los elementos de una lista.",
      },
      {
        type: "splitList",
        label: "Separar",
        description:
          "Convierte un número o texto en una lista de sus caracteres/elementos.",
      },
      {
        type: "listEvenPositions",
        label: "Posiciones pares",
        description: "Devuelve los elementos en posiciones pares de una lista.",
      },
      {
        type: "listOddPositions",
        label: "Posiciones impares",
        description:
          "Devuelve los elementos en posiciones impares de una lista.",
      },
    ],
  },
  {
    id: "distribution",
    title: "Distribución",
    items: [
      {
        type: "replicateFlow",
        label: "Replicar flujo",
        description:
          "Configura y almacena un flujo interno reutilizable dentro del nodo.",
      },
      {
        type: "scatter",
        label: "Distribuir",
        description: "Distribuye una lista a varios nodos",
      },
      {
        type: "gather",
        label: "Reunir",
        description: "Reúne valores de varios nodos en una lista",
      },
    ],
  },
  {
    id: "microbit",
    title: "Micro:bit",
    items: [
      {
        type: "microbitReadButton",
        label: "Leer botón",
        description:
          "Espera una pulsación de botón enviada por la micro:bit y la emite.",
      },
      {
        type: "microbitReadTemperature",
        label: "Temperatura",
        description:
          "Lee la temperatura actual de la micro:bit y la emite como número (°C).",
      },
      {
        type: "microbitWrite",
        label: "micro:bit · Escribir",
        description:
          "Envía texto/comandos al micro:bit (configurable Bluetooth/Serial).",
      },
      {
        type: "microbitSound",
        label: "micro:bit · Sonido",
        description:
          "Activa un sonido en el micro:bit (configurable Bluetooth/Serial).",
      },
    ],
  },
  {
    id: "abstraction",
    title: "Subflujos",
    items: [
      {
        type: "subflow",
        label: "Subflujo",
        description:
          "Encapsula parte del diagrama como un bloque reutilizable.",
      },
    ],
  },
];
