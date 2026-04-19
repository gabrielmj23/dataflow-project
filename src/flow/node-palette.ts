import { NODE_TYPES } from "@/common/constants";

export type NodePaletteItem = {
  type: string;
  label: string;
  description?: string;
  accentColor?: string;
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
  accentColor?: string;
  extensionId?: string;
  /** Optional nested subcategories */
  subcategories?: NodePaletteCategory[];
};

export type AbstractionLevel = 1 | 2 | 3;

export type AbstractionRange = {
  min?: AbstractionLevel;
  max?: AbstractionLevel;
};

const nodeAbstractionLevelMap: Record<
  string,
  AbstractionLevel | AbstractionRange
> = {
  runtimeInput: 1,
  runtimeInputPulse: 1,
  constantNumber: 1,
  constantBoolean: 1,
  constantText: 1,
  constantList: 3,
  timerInput: 2,
  randomInput: 2,
  choiceInput: 2,
  microbitReadButton: 3,
  microbitReadButtonPulse: 3,
  microbitReadTemperature: 3,
  microbitReadTemperaturePulse: 3,
  microbitReadPin: 3,
  microbitReadPinPulse: 3,

  sum: { min: 1, max: 2 },
  subtract: { min: 1, max: 2 },
  multiply: { min: 1, max: 2 },
  divide: { min: 1, max: 2 },
  mod: { min: 1, max: 2 },
  power: { min: 2, max: 2 },
  mathOperation: 2,
  root: 2,
  logarithm: 2,
  floor: 2,
  ceiling: 2,
  round: 2,
  formulaEditor: 3,

  concat: 1,
  replaceText: 1,
  subtractText: 1,
  sliceText: 1,

  comparison: 2,
  comparisonEqual: { min: 1, max: 2 },
  comparisonNotEqual: { min: 1, max: 2 },
  comparisonLess: { min: 1, max: 2 },
  comparisonLessOrEqual: { min: 1, max: 2 },
  comparisonGreater: { min: 1, max: 2 },
  comparisonGreaterOrEqual: { min: 1, max: 2 },
  logicOperation: 2,
  and: { min: 1, max: 2 },
  nand: { min: 1, max: 2 },
  or: { min: 1, max: 2 },
  nor: { min: 1, max: 2 },
  xor: { min: 1, max: 2 },
  not: { min: 1, max: 2 },
  logicFormula: { min: 3 },

  desvio: 1,
  relevo: 1,
  switch: { min: 2, max: 2 },
  selector: 1,
  conditional: 3,
  conditionalPair: 3,

  scatter: 2,
  gather: 2,
  barrier: 2,

  sequence: 1,
  pulseSequence: 1,
  zip: 2,
  unzip: 2,
  filter: 2,
  map: 2,
  sortList: 3,
  accumulate: 2,
  product: 3,
  count: 3,
  listFirst: 1,
  listLast: 1,
  listMin: 2,
  listMax: 2,
  listFrequency: 3,
  listAtPosition: 2,
  listFindElement: 2,
  listRemoveFirst: 1,
  listRemoveLast: 1,
  listPrepend: 1,
  listAppend: 1,
  listIsEmpty: 1,
  listReverse: 2,
  splitList: 2,
  listEvenPositions: 3,
  listOddPositions: 3,

  subflow: 2,
  write: 1,
  microbitWrite: 3,
  microbitSound: 3,
  microbitWritePin: 3,
};

export function isNodeVisibleInLevel(
  type: string,
  currentLevel: AbstractionLevel,
): boolean {
  const levelInfo = nodeAbstractionLevelMap[type] ?? 3;

  if (typeof levelInfo === "number") {
    return levelInfo <= currentLevel;
  }

  const { min, max } = levelInfo;
  const isAboveMin = min === undefined || currentLevel >= min;
  const isBelowMax = max === undefined || currentLevel <= max;

  return isAboveMin && isBelowMax;
}

export function getNodeDescription(type: string): string | undefined {
  for (const category of nodePalette) {
    for (const item of category.items) {
      if (item.type === type) return item.description;
    }
    if (category.subcategories) {
      for (const sub of category.subcategories) {
        for (const item of sub.items) {
          if (item.type === type) return item.description;
        }
      }
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
        description: "Pausa el programa y pide un valor por teclado",
      },
    ],
    subcategories: [
      {
        id: "inputs-constant",
        title: "Constantes",
        items: [
          {
            type: "constantNumber",
            label: "Número",
            description: "Emite siempre el mismo número.",
          },
          {
            type: "constantBoolean",
            label: "Valor Lógico",
            description: "Emite siempre el mismo valor verdadero/falso.",
          },
          {
            type: "constantText",
            label: "Texto",
            description: "Emite siempre el mismo texto.",
          },
          {
            type: "constantList",
            label: "Lista fija",
            description: "Crea una lista de números o textos.",
          },
        ],
      },
      {
        id: "inputs-special",
        title: "Especiales",
        items: [
          {
            type: "timerInput",
            label: "Temporizador",
            description: "Detiene la ejecución por un tiempo establecido.",
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
              "Elige un elemento aleatorio de una lista de opciones.",
          },
        ],
      },
      {
        id: "inputs-pulses",
        title: "Pulsos",
        items: [
          {
            type: "runtimeInputPulse",
            label: "Leer pulsos",
            description:
              "Solicita entradas repetidas y emite un pulso por cada lectura.",
          },
          {
            type: "pulseSequence",
            label: "Generar pulsos",
            description:
              "Genera una secuencia de números como pulsos individuales.",
          },
        ],
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
        description: "Muestra valores en la consola.",
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
        description: "Suma dos números.",
      },
      {
        type: "subtract",
        label: "Restar",
        description: "Resta el segundo número del primero.",
      },
      {
        type: "multiply",
        label: "Multiplicar",
        description: "Multiplica dos números.",
      },
      {
        type: "divide",
        label: "Dividir",
        description: "Divide el primer número entre el segundo.",
      },
      {
        type: "mod",
        label: "Resto",
        description: "Calcula el resto de la división entre dos números.",
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
          "Elige entre sumar, restar, multiplicar, dividir, resto o potencia.",
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
        description: "Une dos textos o listas en una sola.",
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
    title: "Lógica",
    items: [],
    subcategories: [
      {
        id: "control-compare",
        title: "Comparaciones",
        items: [
          {
            type: "comparison",
            label: "Comparación",
            description: "Compara dos números con un operador.",
          },
          {
            type: "comparisonEqual",
            label: "Igual",
            description:
              "Compara dos números y devuelve verdadero si son iguales.",
          },
          {
            type: "comparisonNotEqual",
            label: "Distinto",
            description:
              "Compara dos números y devuelve verdadero si son distintos.",
          },
          {
            type: "comparisonLess",
            label: "Menor",
            description:
              "Compara dos números y devuelve verdadero si el primero es menor.",
          },
          {
            type: "comparisonLessOrEqual",
            label: "Menor o igual",
            description:
              "Compara dos números y devuelve verdadero si el primero es menor o igual.",
          },
          {
            type: "comparisonGreater",
            label: "Mayor",
            description:
              "Compara dos números y devuelve verdadero si el primero es mayor.",
          },
          {
            type: "comparisonGreaterOrEqual",
            label: "Mayor o igual",
            description:
              "Compara dos números y devuelve verdadero si el primero es mayor o igual.",
          },
        ],
      },
      {
        id: "control-logic",
        title: "Lógica",
        items: [
          {
            type: "logicOperation",
            label: "Operación lógica",
            description: "Elige entre AND, NAND, OR, NOR, XOR o NOT.",
          },
          {
            type: "and",
            label: "AND",
            description: "Es verdadero si ambos valores son verdaderos.",
          },
          {
            type: "nand",
            label: "NAND",
            description:
              "Verdadero salvo que todos los valores sean verdaderos.",
          },
          {
            type: "or",
            label: "OR",
            description: "Verdadero si al menos un valor es verdadero.",
          },
          {
            type: "nor",
            label: "NOR",
            description: "Verdadero solo cuando todos los valores son falsos.",
          },
          {
            type: "xor",
            label: "XOR",
            description: "Verdadero si exactamente un valor es verdadero.",
          },
          {
            type: "not",
            label: "NOT",
            description: "Niega un valor lógico de entrada.",
          },
          {
            type: NODE_TYPES.LOGIC_FORMULA_NODE,
            label: "Fórmula Lógica",
            description: "Calcula una expresión con operadores lógicos",
          },
        ],
      },
    ],
  },
  {
    id: "iteration",
    title: "Listas",
    subcategories: [
      {
        id: "lists-creation",
        title: "Construcción",
        items: [
          {
            type: "sequence",
            label: "Generar lista",
            description: "Genera una lista de números (ej. 0..N).",
          },
          {
            type: "zip",
            label: "Unir listas",
            description: "Combina listas elemento a elemento.",
          },
          {
            type: "unzip",
            label: "Separar lista",
            description: "Separa una lista de pares en dos listas.",
          },
          {
            type: "splitList",
            label: "Separar",
            description:
              "Convierte un número o texto en una lista de sus elementos.",
          },
        ],
      },
      {
        id: "lists-transformation",
        title: "Transformación",
        items: [
          {
            type: "filter",
            label: "Filtrar",
            description:
              "Conserva solo los elementos que cumplen una condición.",
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
            description: "Ordena una lista ascendente o descendente.",
          },
          {
            type: "listReverse",
            label: "Voltear",
            description: "Invierte los elementos de una lista.",
          },

          {
            type: "listEvenPositions",
            label: "Posiciones pares",
            description:
              "Devuelve los elementos en posiciones pares de una lista.",
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
        id: "lists-queries",
        title: "Consultas",
        items: [
          {
            type: "count",
            label: "Contar",
            description: "Cuenta cuántos elementos hay en una lista.",
          },
          {
            type: "listFirst",
            label: "Primer elemento",
            description: "Devuelve el primer elemento de una lista.",
          },
          {
            type: "listLast",
            label: "Último elemento",
            description: "Devuelve el último elemento de una lista.",
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
              "Devuelve la primera posición donde aparece un elemento; 0 si no aparece.",
          },
          {
            type: "listIsEmpty",
            label: "Lista vacía",
            description: "Verifica si una lista no tiene elementos.",
          },
          {
            type: "listMin",
            label: "Mínimo",
            description:
              "Devuelve el valor más pequeño de la lista; si está vacía devuelve 0.",
          },
          {
            type: "listMax",
            label: "Máximo",
            description:
              "Devuelve el valor más grande de la lista; si está vacía devuelve 0.",
          },
        ],
      },
      {
        id: "lists-insertion",
        title: "Inserción y Eliminación",
        items: [
          {
            type: "listPrepend",
            label: "Añadir al inicio",
            description: "Agrega un elemento al inicio de la lista.",
          },
          {
            type: "listAppend",
            label: "Añadir al final",
            description: "Agrega un elemento al final de la lista.",
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
        ],
      },
      {
        id: "lists-aggregation",
        title: "Agregación",
        items: [
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
            type: "listFrequency",
            label: "Frecuencia",
            description:
              "Cuenta ocurrencias y devuelve una lista de tuplas (elemento, cantidad).",
          },
        ],
      },
    ],
    items: [],
  },
  {
    id: "flowControl",
    title: "Control de Flujo",
    items: [
      {
        type: "relevo",
        label: "Relevo",
        description:
          "Recibe una entrada por la izquierda y emite siempre el valor conectado por arriba.",
      },
      {
        type: "desvio",
        label: "Desvío",
        description:
          "Desvía el valor de entrada a la salida superior si la condición es verdadera, o a la inferior si es falsa.",
      },
      {
        type: "selector",
        label: "Selector",
        description:
          "Elige entre entrada Verdadero o Falso según una condición.",
      },
      {
        type: "switch",
        label: "Switch",
        description: "Activa una salida según una condición que definas.",
      },
      {
        type: "conditionalPair",
        label: "Condicional",
        description: "Evalúa reglas y entrega un valor según el resultado.",
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
        description: "Define un flujo reutilizable para varios dispositivos.",
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
      {
        type: "barrier",
        label: "Barrera",
        description:
          "Espera por todas las entradas para emitirlas en un solo pulso",
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
          "Lee la temperatura actual de la micro:bit y la emite (°C).",
      },
      {
        type: "microbitReadPin",
        label: "Leer pin",
        description: "Lee un pin de la micro:bit emite el valor.",
      },
      {
        type: "microbitReadButtonPulse",
        label: "Botón pulsos",
        description:
          "Lee pulsaciones del botón de micro:bit en múltiples lecturas.",
      },
      {
        type: "microbitReadTemperaturePulse",
        label: "Temperatura pulsos",
        description:
          "Realiza lecturas de temperatura en pulsos con intervalo configurable.",
      },
      {
        type: "microbitReadPinPulse",
        label: "Pin pulsos",
        description:
          "Lee un pin digital/analógico de micro:bit varias veces en pulsos.",
      },
      {
        type: "microbitWrite",
        label: "micro:bit · Escribir",
        description: "Escribe texto en la micro:bit.",
      },
      {
        type: "microbitSound",
        label: "micro:bit · Sonido",
        description: "Activa un sonido en el micro:bit.",
      },
      {
        type: "microbitWritePin",
        label: "Escribir en pin",
        description: "Escribe un valor en un pin de la micro:bit.",
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
        description: "Encapsula parte del código como un bloque reutilizable.",
      },
    ],
  },
];
