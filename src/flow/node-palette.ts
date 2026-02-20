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

  sum: 1,
  subtract: 1,
  multiply: 1,
  divide: 1,
  mod: 1,
  power: 1,
  floor: 1,
  ceiling: 1,
  round: 1,
  formulaEditor: 3,

  concat: 1,
  replaceText: 1,
  subtractText: 1,
  sliceText: 1,

  comparison: 1,
  and: 1,
  nand: 1,
  or: 1,
  nor: 1,
  xor: 1,
  not: 1,
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
  count: 3,

  subflow: 3,
  write: 1,
  microbitWrite: 3,
  microbitSound: 3,
};

export function getNodeAbstractionLevel(type: string): AbstractionLevel {
  return nodeAbstractionLevelMap[type] ?? 3;
}

export const nodePalette: NodePaletteCategory[] = [
  {
    id: "inputs",
    title: "Entradas",
    items: [
      {
        type: "runtimeInput",
        label: "Entrada",
        description:
          "Pausa la ejecución y solicita un número al usuario en tiempo real.",
      },
      {
        type: "constantNumber",
        label: "Constante numérica",
        description: "Emite siempre el mismo número configurado.",
      },
      {
        type: "constantBoolean",
        label: "Constante lógica",
        description: "Emite siempre el mismo valor verdadero/falso.",
      },
      {
        type: "constantText",
        label: "Constante de texto",
        description: "Emite siempre el mismo texto configurado.",
      },
      {
        type: "constantList",
        label: "Lista constante",
        description: "Crea una lista fija de números o textos.",
      },
      {
        type: "timerInput",
        label: "Timer",
        description: "Dispara valores periódicamente cada cierto intervalo.",
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
        type: "microbitReadButton",
        label: "micro:bit · Leer botón",
        description:
          "Espera una pulsación de botón enviada por la micro:bit y la emite.",
      },
    ],
  },
  {
    id: "math",
    title: "Matemática",
    items: [
      { type: "sum", label: "Sumar", description: "Suma dos valores numéricos." },
      { type: "subtract", label: "Restar", description: "Resta el segundo valor del primero." },
      { type: "multiply", label: "Multiplicar", description: "Multiplica dos valores numéricos." },
      { type: "divide", label: "Dividir", description: "Divide el primer valor entre el segundo." },
      { type: "mod", label: "Módulo", description: "Calcula el resto de la división entre dos valores." },
      { type: "power", label: "Potencia", description: "Eleva una base a un exponente." },
      { type: "floor", label: "Piso", description: "Redondea hacia abajo." },
      { type: "ceiling", label: "Techo", description: "Redondea hacia arriba." },
      { type: "round", label: "Redondear", description: "Redondea al entero más cercano." },
      { type: "formulaEditor", label: "Editor de fórmulas", description: "Calcula una expresión con variables numéricas." },
    ],
  },
  {
    id: "text",
    title: "Texto",
    items: [
      { type: "concat", label: "Concatenar", description: "Une dos cadenas o listas en una sola." },
      { type: "replaceText", label: "Reemplazar", description: "Sustituye coincidencias de un texto por otro." },
      { type: "subtractText", label: "Sustraer", description: "Elimina todas las ocurrencias de un fragmento en un texto." },
      { type: "sliceText", label: "Recortar", description: "Devuelve un segmento del texto entre posición inicio y fin." },
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
    id: "iteration",
    title: "Listas",
    items: [
      {
        type: "sequence",
        label: "Generar secuencia",
        description: "Genera una secuencia de números (ej. 0..N).",
      },
      {
        type: "pulseSequence",
        label: "Generar pulsos",
        description:
          "Genera una secuencia de números como pulsos individuales.",
      },
      {
        type: "zip",
        label: "Zip",
        description: "Combina listas elemento a elemento.",
      },
      {
        type: "unzip",
        label: "Unzip",
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
        label: "Map",
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
        description: "Reduce una lista acumulando un valor (fold).",
      },
      {
        type: "count",
        label: "Contar",
        description: "Cuenta cuántos elementos hay en una lista.",
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
    id: "microbit",
    title: "Micro:bit",
    items: [
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
];
