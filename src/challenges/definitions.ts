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

export type ChallengeGrading = {
  expectedConsole: string[];
  matchMode?: "exact" | "contains" | "regex";
  timeoutMs?: number;
};

export type ChallengeDefinition = {
  id: string;
  title: string;
  description: string;
  sampleInput?: string;
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

  "echo-basic": {
    id: "echo-basic",
    title: "Máquina de eco",
    description:
      "Vamos a crear una máquina de eco. Todo lo que ingrese la entrada debe aparecer en la salida. Conecta la entrada fija que ves en el canvas directamente al nodo Escribir.",
    sampleInput: "Entrada fija: eco",
    constraints: {
      paletteAllowList: ["constantText", "write"],
      lockedNodes: [
        {
          id: "locked-const-echo",
          type: "constantText",
          position: { x: 0, y: 0 },
          data: { value: "eco", label: "Entrada" },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      expectedConsole: ["eco"],
      matchMode: "exact",
    },
  },

  "super-hero-name": {
    id: "super-hero-name",
    title: "Nombre de superhéroe",
    description:
      "Crea tu nombre de superhéroe. Usa el nodo Concatenar para unir la palabra fija 'Super ' con tu nombre real y envíalo al nodo Escribir.",
    sampleInput: "Ejemplo: Ana → Super Ana",
    constraints: {
      paletteAllowList: ["constantText", "concat", "write"],
      lockedNodes: [
        {
          id: "locked-prefix-super",
          type: "constantText",
          position: { x: 0, y: 0 },
          data: { value: "Super ", label: "Prefijo" },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      expectedConsole: ["^Super\\s+.+$"],
      matchMode: "regex",
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
