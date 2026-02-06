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

/**
 * Ajusta estos valores al tamaño real (en pixeles) de tu imagen del mapa.
 * Recomiendo usar el tamaño “natural” de la imagen para que ubicar puntos sea fácil.
 */
export const CHALLENGE_MAP_VIEWBOX = {
  width: 2752,
  height: 1536,
} as const;

export const challengeRegistry: ChallengeDefinition[] = [
  {
    id: "starter-kit",
    title: "Kit inicial",
    difficulty: "Fácil",
    duration: "10 min",
    description:
      "Descubre los nodos básicos y aprende a crear tu primer flujo interactivo paso a paso.",
    objectives: ["Conectar entradas y salidas", "Usar nodos de control"],
    // Normalizado desde el mapa ejemplo 1079x626
    mapPoint: { x: 0.1576, y: 0.3276 },
  },
  {
    id: "sensors-101",
    title: "Sensores 101",
    difficulty: "Medio",
    duration: "20 min",
    description:
      "Procesa lecturas simuladas y envía avisos usando combinaciones de nodos lógicos y de lista.",
    objectives: ["Filtrar datos", "Crear acciones por umbral"],
    prerequisites: ["starter-kit"],
    mapPoint: { x: 0.4819, y: 0.4952 },
  },
  {
    id: "micro-retos",
    title: "Micro retos",
    difficulty: "Medio",
    duration: "15 min",
    description:
      "Pequeños puzzles para practicar condicionales, secuencias y subflujos reutilizables.",
    objectives: ["Duplicar subflujos", "Refinar conexiones"],
    prerequisites: ["sensors-101"],
    mapPoint: { x: 0.797, y: 0.4313 },
  },
];
