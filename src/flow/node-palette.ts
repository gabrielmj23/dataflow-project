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
        description: "Elige un elemento aleatorio de una lista de opciones configurables.",
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
    id: "processing",
    title: "Proceso",
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
        label: "Módulo",
        description: "Calcula el resto de la división entre dos valores.",
      },
      {
        type: "power",
        label: "Potencia",
        description: "Eleva una base a un exponente.",
      },
      {
        type: "floor",
        label: "Piso",
        description: "Redondea hacia abajo.",
      },
      {
        type: "ceiling",
        label: "Techo",
        description: "Redondea hacia arriba.",
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
      {
        type: "concat",
        label: "Concatenar",
        description: "Une dos cadenas o listas en una sola.",
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
        type: "and",
        label: "AND",
        description: "Devuelve verdadero si todas las entradas son verdaderas.",
      },
      {
        type: "or",
        label: "OR",
        description: "Devuelve verdadero si al menos una entrada es verdadera.",
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
    ],
  },
  {
    id: "iteration",
    title: "Iteración y listas",
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
        description: "Separa una lista de pares en dos listas (inverso de Zip).",
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
    title: "Abstracción",
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
  }
];
