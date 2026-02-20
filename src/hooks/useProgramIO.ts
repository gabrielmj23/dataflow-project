import { useCallback, useRef } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import {
  deserializeProgram,
  downloadSerializedProgram,
  serializeProgram,
  type SerializedProgramV1,
} from "@/flow/serialization";
import type { FlowEdge, FlowNode } from "@/utils/flow";

const REMOTE_CONFIG_KEYS = new Set([
  "executionTarget",
  "controllerId",
  "transport",
  "connectionType",
  "microbitSlot",
]);

function sanitizePortableNode(node: FlowNode): FlowNode {
  const nextData = sanitizePortableValue(node.data);
  return {
    ...node,
    data: nextData as FlowNode["data"],
  };
}

function sanitizePortableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePortableValue(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  if (isFlowNodeLike(record)) {
    return sanitizePortableNode(record as FlowNode);
  }

  const next: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (REMOTE_CONFIG_KEYS.has(key)) continue;
    next[key] = sanitizePortableValue(raw);
  }
  return next;
}

function isFlowNodeLike(value: Record<string, unknown>): boolean {
  return typeof value.id === "string" && ("type" in value || "data" in value);
}

type UseProgramIOParams = {
  reactFlowInstance: ReactFlowInstance | null;
  programName: string;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  setProgramName: React.Dispatch<React.SetStateAction<string>>;
};

export function useProgramIO({
  reactFlowInstance,
  programName,
  setNodes,
  setEdges,
  setProgramName,
}: UseProgramIOParams) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onDownloadClick = useCallback(() => {
    if (!reactFlowInstance) return;
    const nodes = reactFlowInstance
      .getNodes()
      .map((node) => sanitizePortableNode(node as FlowNode));
    const edges = reactFlowInstance.getEdges();
    const viewport = reactFlowInstance.getViewport();
    const serialized = serializeProgram(
      {
        nodes,
        edges,
        viewport,
        programName,
      },
      true,
    );
    const base = programName?.trim() || `dataflow-program-${Date.now()}`;
    const safe = base.replace(/[^a-zA-Z0-9-_. ]+/g, "_");
    const filename = `${safe}.json`;
    downloadSerializedProgram(serialized, filename);
  }, [programName, reactFlowInstance]);

  const onLoadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onProgramFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? "");
          const parsed = JSON.parse(text) as SerializedProgramV1;

          if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
            console.error(
              "[dataflow] Versión de programa no soportada",
              parsed,
            );
            window.alert(
              "No se pudo cargar el programa: archivo inválido o versión no soportada.",
            );
            return;
          }

          const {
            nodes: desNodes,
            edges: desEdges,
            viewport,
            programName: loadedName,
          } = deserializeProgram(parsed);

          setNodes(desNodes as FlowNode[]);
          setEdges(desEdges as FlowEdge[]);

          if (loadedName && typeof loadedName === "string") {
            setProgramName(loadedName);
          }

          if (viewport && reactFlowInstance?.setViewport) {
            reactFlowInstance.setViewport(
              { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
              { duration: 0 },
            );
          }
        } catch (error) {
          console.error("[dataflow] Error al cargar programa", error);
          window.alert(
            "No se pudo cargar el programa: el archivo no contiene un JSON válido.",
          );
        } finally {
          // Permite volver a seleccionar el mismo archivo si se desea
          event.target.value = "";
        }
      };

      reader.readAsText(file, "utf-8");
    },
    [reactFlowInstance, setEdges, setNodes, setProgramName],
  );

  return {
    fileInputRef,
    onDownloadClick,
    onLoadClick,
    onProgramFileChange,
  };
}
