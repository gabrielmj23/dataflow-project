import type { Edge, Node, Viewport } from "@xyflow/react";

export type SerializedViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type SerializedNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: unknown;
};

export type SerializedEdge = {
  id: string;
  type?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
};

export type SerializedProgramV1 = {
  version: 1;
  /** Nombre legible del programa (opcional para compatibilidad hacia atrás) */
  programName?: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  viewport?: SerializedViewport;
};

/**
 * Deep-clones a value using JSON serialization.
 *
 * Nota: sólo debe usarse con datos serializables a JSON. Valores como funciones,
 * Map/Set, Date u otros objetos no-serializables pueden perder información.
 *
 * @param value El valor a clonar (debe ser JSON-serializable)
 * @returns Una copia profunda del valor
 */
function jsonClone<T>(value: T): T {
  // Node/edge data in this app is expected to be JSON-serializable.
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Serializa el estado actual del editor a un formato versionado.
 *
 * - Clona `node.data` y `edge.data` para evitar referencias compartidas.
 * - Normaliza `id`, `position` y handles a tipos primitivos.
 *
 * Este resultado está pensado para persistencia o descarga y puede ser
 * reimportado con `deserializeProgram`.
 *
 * @param params Objeto con `nodes`, `edges`, opcionalmente `viewport` y `programName`.
 * @param forUi Si es `true`, prepara la serialización para uso en UI (por defecto: `true`).
 * @returns Un `SerializedProgramV1` listo para guardarse como JSON.
 */
export function serializeProgram(
  params: {
    nodes: Node[];
    edges: Edge[];
    viewport?: Viewport | SerializedViewport;
    programName?: string;
  },
  forUi: boolean = true,
): SerializedProgramV1 {
  const viewport =
    forUi && params.viewport
      ? {
          x: params.viewport.x,
          y: params.viewport.y,
          zoom: params.viewport.zoom,
        }
      : undefined;

  const nodes: SerializedNode[] = params.nodes.map((n) => ({
    id: String(n.id),
    type: n.type,
    position: {
      x: Number(n.position?.x ?? 0),
      y: Number(n.position?.y ?? 0),
    },
    data: n.data === undefined ? undefined : jsonClone(n.data),
  }));

  const edges: SerializedEdge[] = params.edges.map((e) => ({
    id: String(e.id),
    type: e.type,
    source: String(e.source),
    target: String(e.target),
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    data: e.data === undefined ? undefined : jsonClone(e.data),
  }));

  return {
    version: 1,
    programName: params.programName,
    nodes,
    edges,
    ...(forUi ? { viewport } : {}),
  };
}

/**
 * Deserializa un `SerializedProgramV1` a las estructuras `Node[]` y `Edge[]`
 * utilizadas por React Flow / XYFlow.
 *
 * - Normaliza `data` a objetos (`Record<string, unknown>`) para evitar
 *   problemas con tipos `undefined`/`null` en la librería.
 * - Realiza una clonación profunda de los campos `data`.
 *
 * @param serialized El programa serializado (versión 1)
 * @returns Un objeto con `nodes`, `edges` y opcional `viewport` listo para
 *          pasarse a React Flow.
 */
export function deserializeProgram(serialized: SerializedProgramV1): {
  nodes: Node[];
  edges: Edge[];
  viewport?: SerializedViewport;
  programName?: string;
} {
  const nodes: Node[] = serialized.nodes.map((n) => {
    const data = n.data === undefined ? {} : jsonClone(n.data);
    return {
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      data: (data ?? {}) as Record<string, unknown>,
    };
  });

  const edges: Edge[] = serialized.edges.map((e) => {
    const data = e.data === undefined ? undefined : jsonClone(e.data);
    return {
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      data: data === null ? undefined : (data as Record<string, unknown>),
    };
  });

  return {
    nodes,
    edges,
    viewport: serialized.viewport,
    programName: serialized.programName,
  };
}

/**
 * Crea un archivo JSON en el navegador y fuerza su descarga.
 *
 * Nota: esta función debe ejecutarse en un entorno con `document` (navegador).
 *
 * @param serialized Programa serializado (versión 1)
 * @param filename Nombre de archivo sugerido (incluye extensión .json)
 */
export function downloadSerializedProgram(
  serialized: SerializedProgramV1,
  filename = "program.json",
) {
  const text = JSON.stringify(serialized, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
