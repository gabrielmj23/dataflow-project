export type ChallengeId = string;

export type ChallengeDefinition = {
  id: ChallengeId;
  title: string;
  description: string;
  difficulty: "Fácil" | "Medio" | "Difícil";
  duration: string;
  objectives: string[];
  /** ids de desafíos que deben completarse antes de desbloquear este */
  prerequisites?: ChallengeId[];
  /**
   * Coordenadas del punto en el mapa.
   * - Recomendado: normalizadas (0..1) relativas al ancho/alto del mapa.
   * - Alternativa: pixeles del viewBox (si x o y > 1 se asume px).
   */
  mapPoint: { x: number; y: number };
};

export const CHALLENGE_MAP_VIEWBOX = {
  width: 2752,
  height: 1536,
} as const;

export const challengeRegistry: ChallengeDefinition[] = [
  {
    id: "c1-starter-kit",
    title: "1. Kit inicial",
    difficulty: "Fácil",
    duration: "5 min",
    description:
      "Descubre los nodos básicos y aprende a crear tu primer flujo interactivo paso a paso.",
    objectives: ["Conectar nodos", "Usar el nodo Imprimir"],
    mapPoint: { x: 0.15, y: 0.36 },
  },
  {
    id: "c2-logic-basics",
    title: "2. Lógica Básica",
    difficulty: "Fácil",
    duration: "10 min",
    description:
      "Aprende a tomar decisiones con nodos condicionales. Si sucede A, haz B.",
    objectives: ["Usar Switch/Branch", "Comparar números"],
    prerequisites: ["c1-starter-kit"],
    mapPoint: { x: 0.105, y: 0.76 },
  },
  {
    id: "c3-math-ops",
    title: "3. Operaciones Matemáticas",
    difficulty: "Fácil",
    duration: "10 min",
    description:
      "Calcula valores dinámicos usando sumas, restas y multiplicaciones en tiempo real.",
    objectives: ["Nodos matemáticos", "Transformar datos"],
    prerequisites: ["c2-logic-basics"],
    mapPoint: { x: 0.337, y: 0.7 },
  },
  {
    id: "c4-sensors-intro",
    title: "4. Sensores 101",
    difficulty: "Medio",
    duration: "15 min",
    description:
      "Procesa lecturas simuladas y envía avisos usando umbrales de activación.",
    objectives: ["Leer sensores", "Filtrar ruido"],
    prerequisites: ["c3-math-ops"],
    mapPoint: { x: 0.438, y: 0.45 },
  },
  {
    id: "c5-lists-arrays",
    title: "5. Listas de Datos",
    difficulty: "Difícil",
    duration: "25 min",
    description:
      "Maneja colecciones de datos, filtra elementos y procesa listas completas.",
    objectives: ["Iterar listas", "Filtrar arrays"],
    prerequisites: ["c4-sensors-intro"],
    mapPoint: { x: 0.658, y: 0.38 },
  },
  {
    id: "c6-timer-loops",
    title: "6. Bucles y Tiempo",
    difficulty: "Medio",
    duration: "20 min",
    description:
      "Crea secuencias que se repiten o esperan un tiempo determinado para ejecutarse.",
    objectives: ["Usar Timers", "Crear contadores"],
    prerequisites: ["c5-lists-arrays"],
    mapPoint: { x: 0.485, y: 0.65 },
  },
  {
    id: "c7-subflows",
    title: "7. Poder de Subflujos",
    difficulty: "Difícil",
    duration: "20 min",
    description:
      "Empaqueta lógica compleja en bloques reutilizables para limpiar tus programas.",
    objectives: ["Crear subflujo", "Reutilizar lógica"],
    prerequisites: ["c6-timer-loops"],
    mapPoint: { x: 0.7, y: 0.894 },
  },
  {
    id: "c8-patterns",
    title: "8. Patrones de Diseño",
    difficulty: "Difícil",
    duration: "45 min",
    description:
      "Un desafío integral que pone a prueba todas tus habilidades de ingeniería de datos.",
    objectives: ["Proyecto completo", "Optimización"],
    prerequisites: ["c7-subflows"],
    mapPoint: { x: 0.912, y: 0.75 },
  },
  {
    id: "c9-final-task",
    title: "9. La Gran Misión",
    difficulty: "Difícil",
    duration: "30 min",
    description:
      "Combina todo lo aprendido para resolver problemas de orquestación complejos.",
    objectives: ["Máquina de estados", "Paralelismo"],
    prerequisites: ["c8-patterns"],
    mapPoint: { x: 0.813, y: 0.36 },
  },
];
