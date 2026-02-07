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

  group: 1 | 2;
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
      initialEdges: [
        {
          id: "e-const2-to-mult",
          source: "locked-const-2",
          target: "locked-multiply",
          targetHandle: "in-1",
        },
      ],
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
      initialEdges: [
        {
          id: "e-const2-to-mult",
          source: "locked-const-2",
          target: "locked-multiply",
          targetHandle: "in-1",
        },
      ],
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
      paletteAllowList: ["concat", "write"],
      lockedNodes: [
        {
          id: "locked-prefix-super",
          type: "constantText",
          position: { x: -150, y: -100 },
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
      "Tienes 10 puntos. Además, ganaste un bono que vale 'el doble de tus puntos' (10 x 2). Saca dos cables del 10: uno directo a la Suma, y otro que pase por la Multiplicación antes de llegar a la Suma. Así sumarás 10 + 20.",
    sampleInput: "Salida esperada: 30",
    group: 1,
    level: 8,
    constraints: {
      paletteAllowList: ["constantNumber", "multiply", "sum", "write"],
      lockedNodes: [
        {
          id: "locked-const-2",
          type: "constantNumber",
          position: { x: -140, y: -90 },
          data: { value: 2 },
          movable: false,
        },
        {
          id: "locked-multiply",
          type: "multiply",
          position: { x: -20, y: -80 },
          movable: false,
        },
        {
          id: "locked-const-10",
          type: "constantNumber",
          position: { x: -140, y: 10 },
          data: { value: 10 },
          movable: false,
        },
        {
          id: "locked-sum",
          type: "sum",
          position: { x: 150, y: 0 },
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

  "autenticacion-dos-factores": {
    id: "autenticacion-dos-factores",
    title: "Autenticación de Dos Factores",
    description:
      "Diseña un sistema de seguridad. La puerta solo se abre si: 1) La contraseña es igual a 'admin' Y 2) El usuario es igual a 'user'. Usa el nodo AND para conectar ambas validaciones.",
    sampleInput: "Salida esperada: true solo si usuario=user y contraseña=admin",
    group: 2,
    level: 1,
    constraints: {
      paletteAllowList: [
        "runtimeInput",
        "constantText",
        "constantBoolean",
        "comparison",
        "and",
        "write",
      ],
      lockedNodes: [
        {
          id: "locked-read-user",
          type: "runtimeInput",
          position: { x: -220, y: -40 },
          data: { prompt: "Usuario", valueType: "text" },
          movable: false,
        },
        {
          id: "locked-read-pass",
          type: "runtimeInput",
          position: { x: -220, y: 60 },
          data: { prompt: "Contraseña", valueType: "text" },
          movable: false,
        },
        {
          id: "locked-const-user",
          type: "constantText",
          position: { x: -60, y: -100 },
          data: { value: "user" },
          movable: false,
        },
        {
          id: "locked-const-admin",
          type: "constantText",
          position: { x: -60, y: 140 },
          data: { value: "admin" },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "Credenciales correctas", inputs: ["user", "admin"], expected: ["true"] },
        { name: "Clave incorrecta", inputs: ["user", "bad"], expected: ["false"] },
        { name: "Usuario incorrecto", inputs: ["foo", "admin"], expected: ["false"] },
      ],
      matchMode: "exact",
      caseInsensitive: true,
    },
  },

  "detector-pares-impares": {
    id: "detector-pares-impares",
    title: "Detector de Pares e Impares",
    description:
      "Necesitamos clasificar números. Si el residuo (Módulo) de dividir un número entre 2 es igual a 0, el número es PAR. Crea un sistema que devuelva 'True' si el número ingresado es par.",
    sampleInput: "Ejemplo: entrada 4 → true; entrada 5 → false",
    group: 2,
    level: 2,
    constraints: {
      paletteAllowList: ["runtimeInput", "constantNumber", "mod", "comparison", "write"],
      lockedNodes: [
        {
          id: "locked-read-num",
          type: "runtimeInput",
          position: { x: -220, y: 0 },
          data: { prompt: "Ingresa un número", valueType: "number" },
          movable: false,
        },
        {
          id: "locked-const-2-mod",
          type: "constantNumber",
          position: { x: -220, y: 100 },
          data: { value: 2 },
          movable: false,
        },
        {
          id: "locked-mod",
          type: "mod",
          position: { x: -40, y: 0 },
          movable: false,
        },
        {
          id: "locked-compare-zero",
          type: "comparison",
          position: { x: 140, y: 0 },
          data: { operator: "==" },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [
        {
          id: "e-const2-to-mod",
          source: "locked-const-2-mod",
          target: "locked-mod",
          targetHandle: "in-2",
        },
      ],
    },
    grading: {
      testCases: [
        { name: "Par", inputs: ["4"], expected: ["true"] },
        { name: "Impar", inputs: ["5"], expected: ["false"] },
      ],
      matchMode: "exact",
    },
  },

  "censurador-chat": {
    id: "censurador-chat",
    title: "El Censurador de Chat",
    description:
      "Estás programando un bot de moderación para un chat. Si alguien escribe la palabra prohibida 'tonto', el sistema debe reemplazarla automáticamente por '*****'. El resto del mensaje debe quedar igual.",
    sampleInput: "Ejemplo: 'Eres tonto' → 'Eres *****'",
    group: 2,
    level: 3,
    constraints: {
      paletteAllowList: ["runtimeInput", "constantText", "replaceText", "write"],
      lockedNodes: [
        {
          id: "locked-read-msg",
          type: "runtimeInput",
          position: { x: -240, y: 0 },
          data: { prompt: "Ingresa mensaje", valueType: "text" },
          movable: false,
        },
        {
          id: "locked-bad-word",
          type: "constantText",
          position: { x: -60, y: -80 },
          data: { value: "tonto" },
          movable: false,
        },
        {
          id: "locked-mask-word",
          type: "constantText",
          position: { x: -60, y: 80 },
          data: { value: "*****" },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "Censura", inputs: ["Eres tonto"], expected: ["Eres *****"] },
        { name: "Sin insulto", inputs: ["Hola amigo"], expected: ["Hola amigo"] },
      ],
      matchMode: "exact",
      caseInsensitive: true,
    },
  },

  "sistema-calificaciones": {
    id: "sistema-calificaciones",
    title: "Sistema de Calificaciones",
    description:
      "Automatiza las notas. Configura el Condicional + Selector con estas reglas: Si Nota >= 18 sale 'A'. Si Nota >= 10 sale 'B'. Si es menor, sale 'C'. Conecta las condiciones numéricas a las entradas correspondientes del selector.",
    sampleInput: "Ejemplos: 19→A, 15→B, 9→C",
    group: 2,
    level: 4,
    constraints: {
      paletteAllowList: [
        "runtimeInput",
        "conditional",
        "selector",
        "comparison",
        "constantNumber",
        "constantText",
        "write",
      ],
      lockedNodes: [
        {
          id: "locked-read-nota",
          type: "runtimeInput",
          position: { x: -260, y: 0 },
          data: { prompt: "Ingresa nota", valueType: "number" },
          movable: false,
        },
        {
          id: "locked-const-18",
          type: "constantNumber",
          position: { x: -120, y: -90 },
          data: { value: 18 },
          movable: false,
        },
        {
          id: "locked-const-10",
          type: "constantNumber",
          position: { x: -120, y: 90 },
          data: { value: 10 },
          movable: false,
        },
        {
          id: "locked-cond",
          type: "conditional",
          position: { x: 0, y: 0 },
          movable: false,
        },
        {
          id: "locked-selector",
          type: "selector",
          position: { x: 180, y: 0 },
          movable: false,
        },
        {
          id: "locked-grade-a",
          type: "constantText",
          position: { x: 60, y: -120 },
          data: { value: "A" },
          movable: false,
        },
        {
          id: "locked-grade-b",
          type: "constantText",
          position: { x: 60, y: 60 },
          data: { value: "B" },
          movable: false,
        },
        {
          id: "locked-grade-c",
          type: "constantText",
          position: { x: 60, y: 160 },
          data: { value: "C" },
          movable: false,
        },
        {
          id: "locked-write-grade",
          type: "write",
          position: { x: 360, y: 0 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "A", inputs: ["19"], expected: ["A"] },
        { name: "B", inputs: ["15"], expected: ["B"] },
        { name: "C", inputs: ["9"], expected: ["C"] },
      ],
      matchMode: "exact",
      caseInsensitive: true,
    },
  },

  "generador-numeros": {
    id: "generador-numeros",
    title: "Generador de Números",
    description:
      "Necesitamos probar el rendimiento del sistema. Genera una lista automática de datos de prueba que empiece en 0, termine en 100 y avance de 5 en 5 (Step).",
    sampleInput: "Salida esperada: 0, 5, 10, ... 100",
    group: 2,
    level: 5,
    constraints: {
      paletteAllowList: ["sequence", "constantNumber", "write"],
      lockedNodes: [],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "Rango", inputs: [], expected: ["0", "5", "50", "100"] },
      ],
      matchMode: "contains",
    },
  },

  "aplicar-impuestos": {
    id: "aplicar-impuestos",
    title: "Aplicar Impuestos",
    description:
      "Tienes una lista bruta de precios. Tu tarea es aplicar el IVA (16%) a cada uno de los elementos de la lista. Usa el nodo Mapear para multiplicar cada precio por 1.16.",
    sampleInput: "Salida esperada: [116, 232, 58]",
    group: 2,
    level: 6,
    constraints: {
      paletteAllowList: ["map", "multiply", "constantNumber", "constantList", "write"],
      lockedNodes: [
        {
          id: "locked-prices",
          type: "constantList",
          position: { x: -220, y: 0 },
          data: { items: [100, 200, 50] },
          movable: false,
        },
        {
          id: "locked-iva",
          type: "constantNumber",
          position: { x: -220, y: 120 },
          data: { value: 1.16 },
          movable: false,
        },
        {
          id: "locked-map",
          type: "map",
          position: { x: -40, y: 0 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "IVA", inputs: [], expected: ["116", "232", "58"] },
      ],
      matchMode: "contains",
    },
  },

  "filtro-aprobados": {
    id: "filtro-aprobados",
    title: "Filtro de Aprobados",
    description:
      "De la lista de todas las notas posibles (1-20), necesitamos extraer solo las aprobatorias. Usa Filtrar junto con una condición para dejar pasar solo los números mayores o iguales a 10.",
    sampleInput: "Salida esperada: 10..20",
    group: 2,
    level: 7,
    constraints: {
      paletteAllowList: ["sequence", "filter", "comparison", "constantNumber", "write"],
      lockedNodes: [
        {
          id: "locked-seq-notas",
          type: "sequence",
          position: { x: -220, y: -20 },
          movable: false,
        },
        {
          id: "locked-const-10-aprob",
          type: "constantNumber",
          position: { x: -220, y: 120 },
          data: { value: 10 },
          movable: false,
        },
        {
          id: "locked-filter",
          type: "filter",
          position: { x: -40, y: 0 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [
        { name: "Aprobados", inputs: [], expected: ["10", "15", "20"] },
      ],
      matchMode: "contains",
    },
  },

  "contador-ingresos": {
    id: "contador-ingresos",
    title: "Contador de Ingresos",
    description:
      "El jefe necesita el total de ventas del día. Usa el nodo Acumular (Reduce) configurado con una Suma para combinar todos los valores de la lista en un solo número total.",
    sampleInput: "Salida esperada: 350",
    group: 2,
    level: 8,
    constraints: {
      paletteAllowList: ["reduce", "sum", "constantList", "write"],
      lockedNodes: [
        {
          id: "locked-ventas",
          type: "constantList",
          position: { x: -200, y: 0 },
          data: { items: [100, 200, 50] },
          movable: false,
        },
        {
          id: "locked-reduce",
          type: "reduce",
          position: { x: 0, y: 0 },
          movable: false,
        },
        {
          id: "locked-sum-op",
          type: "sum",
          position: { x: 180, y: 0 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [],
    },
    grading: {
      testCases: [{ name: "Total", inputs: [], expected: ["350"] }],
      matchMode: "exact",
    },
  },

  "base-usuarios": {
    id: "base-usuarios",
    title: "Base de Datos de Usuarios",
    description:
      "Tenemos una lista de nombres ['Ana', 'Bob', 'Carlos'] y una de IDs [101, 102, 103]. El sistema requiere que estén unidos. Usa Emparejar para crear una lista de tuplas donde cada usuario tenga su ID asociado.",
    sampleInput: "Salida esperada: (Ana,101), (Bob,102), (Carlos,103)",
    group: 2,
    level: 9,
    constraints: {
      paletteAllowList: ["constantList", "zip", "write"],
      lockedNodes: [
        {
          id: "locked-names",
          type: "constantList",
          position: { x: -220, y: -40 },
          data: { items: ["Ana", "Bob", "Carlos"] },
          movable: false,
        },
        {
          id: "locked-ids",
          type: "constantList",
          position: { x: -220, y: 80 },
          data: { items: [101, 102, 103] },
          movable: false,
        },
        {
          id: "locked-zip",
          type: "zip",
          position: { x: -40, y: 20 },
          movable: false,
        },
        {
          id: "locked-write-zip",
          type: "write",
          position: { x: 200, y: 20 },
          movable: false,
        },
      ],
      initialNodes: [],
      initialEdges: [
        {
          id: "e-names-zip",
          source: "locked-names",
          target: "locked-zip",
          targetHandle: "in-1",
        },
        {
          id: "e-ids-zip",
          source: "locked-ids",
          target: "locked-zip",
          targetHandle: "in-2",
        },
      ],
    },
    grading: {
      testCases: [
        {
          name: "Zip",
          inputs: [],
          expected: ["Ana", "101", "Bob", "102", "Carlos", "103"],
        },
      ],
      matchMode: "contains",
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
