import type { FlowEdge, FlowNode } from "@/utils/flow";

export type ChallengeConstraint = {
  paletteAllowList: string[];
  lockedNodes?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
    movable?: boolean;
  }>;
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  maxNodes?: number;
};

export type ChallengeTestCase = {
  name?: string;
  inputs?: string[];
  expected: string[];
};

export type ChallengeGrading = {
  expectedConsole?: string[];
  matchMode?: "exact" | "contains" | "regex";
  /** If true, comparisons (exact/contains/regex) are case-insensitive. */
  caseInsensitive?: boolean;
  /** Optional structured test cases to auto-run the flow. */
  testCases?: ChallengeTestCase[];
  timeoutMs?: number;
};

export type ChallengeDefinition = {
  id: string;
  title: string;
  description: string;
  sampleInput?: string;
  /** Group 1: 8-11, Group 2: 12-16 */
  group: 1 | 2;
  /** Difficulty or progression level within the group. */
  level: number;
  constraints: ChallengeConstraint;
  grading: ChallengeGrading;
};

const definitions: Record<string, ChallengeDefinition> = {
  "sum-to-5": {
    id: "sum-to-5",
    title: "Suma hasta 5",
    description:
      "Usa el nodo Sumar para producir el número 5 en la consola. Arrastra un nodo Sumar, conecta la constante fija y tu propia constante para lograr que la salida sea 5.",
    sampleInput: "Salida esperada: 5",
    group: 1,
    level: 1,
    constraints: {
      paletteAllowList: ["sum", "constantNumber", "write"],
      lockedNodes: [
        {
          id: "locked-const-2",
          type: "constantNumber",
          position: { x: 0, y: 0 },
          data: { value: 2, label: "Base 2" },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      expectedConsole: ["5"],
      matchMode: "exact",
    },
  },
  
  "hola-mundo": {
    id: "hola-mundo",
    title: "Hola Mundo",
    description:
      "Vamos a crear una máquina que diga \"Hola mundo\". Configura el nodo Constante de texto con el mensaje y conéctalo al nodo Escribir. Presiona Ejecutar para ver la salida.",
    sampleInput: "Salida esperada: Hola mundo",
    group: 1,
    level: 1,
    constraints: {
      paletteAllowList: ["constantText", "write"],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        {
          name: "Caso único",
          inputs: [],
          expected: ["Hola mundo"],
        },
      ],
      matchMode: "exact",
      caseInsensitive: true,
    },
  },

  "super-hero-name": {
    id: "super-hero-name",
    title: "Nombre de superhéroe",
    description:
      "Crea tu nombre de superhéroe. Usa el nodo Concatenar para unir la palabra fija 'Super ' con tu nombre real y envíalo al nodo Escribir.",
    sampleInput: "Ejemplo: Ana → Super Ana",
    group: 1,
    level: 2,
    constraints: {
      paletteAllowList: ["runtimeInput", "constantText", "concat", "write"],
      lockedNodes: [
        {
          id: "locked-prefix-super",
          type: "constantText",
          position: { x: 0, y: 0 },
          data: { value: "Super ", label: "Prefijo" },
          movable: false,
        },
        {
          id: "locked-read-name",
          type: "runtimeInput",
          position: { x: -150, y: 0 },
          data: { prompt: "Escribe tu nombre", valueType: "text" },
          movable: false,
        },
        {
          id: "locked-write-name",
          type: "write",
          position: { x: 180, y: 0 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "Ana", inputs: ["Ana"], expected: ["Super Ana"] },
        { name: "Leo", inputs: ["Leo"], expected: ["Super Leo"] },
      ],
      matchMode: "exact",
      caseInsensitive: true,
    },
  },

  "calculadora-compras": {
    id: "calculadora-compras",
    title: "Calculadora de compras",
    description:
      "Compraste dos dulces: uno cuesta 5 y otro cuesta 3. Calcula cuánto debes pagar en total.",
    sampleInput: "Salida esperada: 8",
    group: 1,
    level: 3,
    constraints: {
      paletteAllowList: ["constantNumber", "sum", "write"],
      lockedNodes: [
        {
          id: "locked-const-5",
          type: "constantNumber",
          position: { x: -140, y: -40 },
          data: { value: 5 },
          movable: false,
        },
        {
          id: "locked-const-3",
          type: "constantNumber",
          position: { x: -140, y: 40 },
          data: { value: 3 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [{ name: "Compra", inputs: [], expected: ["8"] }],
      matchMode: "exact",
    },
  },

  "la-resta": {
    id: "la-resta",
    title: "La Resta",
    description:
      "Tienes 80 monedas y gastas 13. Calcula cuántas monedas te quedan.",
    sampleInput: "Salida esperada: 67",
    group: 1,
    level: 4,
    constraints: {
      paletteAllowList: ["constantNumber", "subtract", "write"],
      lockedNodes: [
        {
          id: "locked-const-80",
          type: "constantNumber",
          position: { x: -140, y: -30 },
          data: { value: 80 },
          movable: false,
        },
        {
          id: "locked-const-13",
          type: "constantNumber",
          position: { x: -140, y: 40 },
          data: { value: 13 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [{ name: "Resta", inputs: [], expected: ["67"] }],
      matchMode: "exact",
    },
  },

  "puntos-dobles": {
    id: "puntos-dobles",
    title: "Puntos Dobles",
    description:
      "Ganaste un bonus de 'Doble Puntos'. Configura la máquina para que cualquier número que ingreses se multiplique por 2.",
    sampleInput: "Ejemplo: entrada 5 → 10",
    group: 1,
    level: 5,
    constraints: {
      paletteAllowList: ["runtimeInput", "constantNumber", "multiply", "write"],
      lockedNodes: [
        {
          id: "locked-read-number",
          type: "runtimeInput",
          position: { x: -180, y: -20 },
          data: { prompt: "Ingresa un número", valueType: "number" },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "Caso 1", inputs: ["5"], expected: ["10"] },
        { name: "Caso 2", inputs: ["7"], expected: ["14"] },
      ],
      matchMode: "exact",
    },
  },

  "control-altura": {
    id: "control-altura",
    title: "Control de altura",
    description:
      "Para entrar al juego debes medir 120 cm o más. Configura el nodo Comparar para ver si cumples la estatura.",
    sampleInput: "Ejemplo: entrada 130 → true",
    group: 1,
    level: 6,
    constraints: {
      paletteAllowList: ["runtimeInput", "constantNumber", "comparison", "write"],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: ">=120 ok", inputs: ["130"], expected: ["true"] },
        { name: "<120 fail", inputs: ["110"], expected: ["false"] },
      ],
      matchMode: "exact",
    },
  },

  "puerta-automatica": {
    id: "puerta-automatica",
    title: "La puerta automática",
    description:
      "Si el interruptor está encendido (Verdadero), la puerta debe decir 'Abierto'. Si está apagado (Falso), debe decir 'Cerrado'. Conecta los textos a las salidas SI y NO del nodo Switch.",
    sampleInput: "Salida esperada: Abierto/Cerrado según interruptor",
    group: 1,
    level: 7,
    constraints: {
      paletteAllowList: ["constantBoolean", "switch", "constantText", "write"],
      lockedNodes: [
        {
          id: "locked-bool-switch",
          type: "constantBoolean",
          position: { x: -180, y: -20 },
          data: { value: true },
          movable: false,
        },
        {
          id: "locked-switch",
          type: "switch",
          position: { x: -40, y: 0 },
          data: { condition: { operator: "truthy" } },
          movable: false,
        },
        {
          id: "locked-text-open",
          type: "constantText",
          position: { x: 140, y: -40 },
          data: { value: "Abierto" },
          movable: false,
        },
        {
          id: "locked-text-closed",
          type: "constantText",
          position: { x: 140, y: 40 },
          data: { value: "Cerrado" },
          movable: false,
        },
        {
          id: "locked-write-door",
          type: "write",
          position: { x: 260, y: 0 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "Interruptor ON", inputs: [], expected: ["Abierto"] },
      ],
      matchMode: "contains",
      caseInsensitive: true,
    },
  },

  "bonus-extra": {
    id: "bonus-extra",
    title: "Bonus Extra",
    description:
      "Tienes 10 puntos base. Además, ganaste un bono que vale 'el doble de tus puntos' (10 x 2). Saca dos cables del 10: uno directo a la Suma, y otro que pase por la Multiplicación antes de llegar a la Suma. Así sumarás 10 + 20.",
    sampleInput: "Salida esperada: 30",
    group: 1,
    level: 8,
    constraints: {
      paletteAllowList: ["constantNumber", "multiply", "sum", "write"],
      lockedNodes: [
        {
          id: "locked-const-10",
          type: "constantNumber",
          position: { x: -180, y: -10 },
          data: { value: 10 },
          movable: false,
        },
        {
          id: "locked-const-2",
          type: "constantNumber",
          position: { x: -140, y: 70 },
          data: { value: 2 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [{ name: "Bonus", inputs: [], expected: ["30"] }],
      matchMode: "exact",
    },
  },

  "tabla-posiciones": {
    id: "tabla-posiciones",
    title: "Tabla de posiciones",
    description:
      "Las puntuaciones del juego están desordenadas: [50, 10, 30, 20, 100]. Pásalas por el nodo Ordenar para verlas de menor a mayor.",
    sampleInput: "Salida esperada: 10, 20, 30, 50, 100",
    group: 1,
    level: 9,
    constraints: {
      paletteAllowList: ["constantList", "sortList", "write"],
      lockedNodes: [
        {
          id: "locked-list-scores",
          type: "constantList",
          position: { x: -160, y: 0 },
          data: { items: [50, 10, 30, 20, 100] },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        {
          name: "Orden ascendente",
          inputs: [],
          expected: ["10", "20", "30", "50", "100"],
        },
      ],
      matchMode: "contains",
      caseInsensitive: true,
    },
  },
};

export async function loadChallengeDefinition(
  id: string,
): Promise<ChallengeDefinition | null> {
  return definitions[id] ?? null;
}

export function listChallenges(): ChallengeDefinition[] {
  return Object.values(definitions);
}
