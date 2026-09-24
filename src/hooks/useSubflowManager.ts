import { useCallback, useState } from "react";
import type {
  FlowBounds,
  FlowEdge,
  FlowNode,
  SubflowSnapshot,
} from "@/utils/flow";
import type { CreateSubflowRequest } from "@/components/CreateSubflowOverlay";
import { buildProhibitedTermsError } from "@/lib/content-moderation";
import { createNodeId } from "@/utils/id";

type SubflowPorts = { inCount: number; outCount: number };

interface UseSubflowManagerParams {
  nodes: FlowNode[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  addOrUpdateTemplate: (template: {
    id: string;
    name: string;
    inCount: number;
    outCount: number;
    nodes: FlowNode[];
    edges: FlowEdge[];
  }) => void;
  isNameTaken: (name: string) => boolean;
  deleteTemplate: (id: string) => void;
  subflowTemplates: Array<{ id: string; name: string }>;
  /**
   * Validador opcional que se llama justo antes de confirmar la creación del
   * subflujo. Si devuelve un `string`, se muestra como error y se cancela el
   * guardado. Si devuelve `null` (o no está definido), la creación procede.
   *
   * @param templateId                    ID que se asignará a la nueva plantilla.
   * @param nodes                         Nodos del interior del subflujo.
   * @param edges                         Aristas del interior del subflujo.
   * @param candidateRecursiveTemplateIds Conjunto de templateIds de nodos de
   *   subflujo que aparecen dentro del snapshot. Cualquiera de ellos puede
   *   representar la "llamada recursiva" (el usuario está redefiniendo una
   *   plantilla existente con el mismo nombre/propósito).
   */
  onValidateSubflow?: (
    templateId: string,
    nodes: FlowNode[],
    edges: FlowEdge[],
    candidateRecursiveTemplateIds: Set<string>,
  ) => string | null;
}

export function useSubflowManager(params: UseSubflowManagerParams) {
  const {
    nodes,
    setNodes,
    setEdges,
    addOrUpdateTemplate,
    isNameTaken,
    deleteTemplate,
    subflowTemplates,
    onValidateSubflow,
  } = params;

  const [isCreateSubflowOpen, setIsCreateSubflowOpen] = useState(false);
  const [subflowName, setSubflowName] = useState("");
  const [pendingSubflowBounds, setPendingSubflowBounds] =
    useState<FlowBounds | null>(null);
  const [pendingSubflowPorts, setPendingSubflowPorts] =
    useState<SubflowPorts | null>(null);
  const [pendingSubflowSnapshot, setPendingSubflowSnapshot] =
    useState<SubflowSnapshot | null>(null);
  const [createSubflowError, setCreateSubflowError] = useState<string | null>(
    null,
  );
  const [createSubflowNameError, setCreateSubflowNameError] = useState<
    string | null
  >(null);
  const [addSubflowToPalette, setAddSubflowToPalette] = useState(false);
  const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = useState<
    string | null
  >(null);
  const [pendingDeleteTemplateName, setPendingDeleteTemplateName] = useState<
    string | null
  >(null);

  const normalizeSubflowName = useCallback((value: unknown): string => {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
  }, []);

  const onCreateSubflowDialogChange = useCallback((open: boolean) => {
    setIsCreateSubflowOpen(open);
    if (!open) {
      setPendingSubflowBounds(null);
      setPendingSubflowPorts(null);
      setPendingSubflowSnapshot(null);
      setCreateSubflowError(null);
      setCreateSubflowNameError(null);
      setAddSubflowToPalette(false);
    }
  }, []);

  const openCreateSubflow = useCallback((request: CreateSubflowRequest) => {
    setPendingSubflowBounds(request.bounds);
    setSubflowName("");
    if (request.ok) {
      setPendingSubflowPorts(request.ports);
      setPendingSubflowSnapshot(request.snapshot);
      setCreateSubflowError(null);
      setCreateSubflowNameError(null);
    } else {
      setPendingSubflowPorts(null);
      setPendingSubflowSnapshot(null);
      setCreateSubflowError(request.message);
      setCreateSubflowNameError(null);
    }
    setIsCreateSubflowOpen(true);
  }, []);

  const createSubflow = useCallback(() => {
    const name = subflowName.trim();
    if (
      !name ||
      !pendingSubflowBounds ||
      !pendingSubflowPorts ||
      !pendingSubflowSnapshot
    ) {
      return;
    }

    const moderationError = buildProhibitedTermsError(
      "El nombre del subflujo",
      name,
    );
    if (moderationError) {
      setCreateSubflowNameError(moderationError);
      return;
    }

    const normalizedName = normalizeSubflowName(name);
    const removedNodeIds = new Set(
      (pendingSubflowSnapshot?.nodes ?? []).map((node) => String(node.id)),
    );
    const hasCanvasConflict = nodes.some((node) => {
      if (String(node.type) !== "subflow") return false;
      if (removedNodeIds.has(String(node.id))) return false;

      const nodeData = (node.data ?? {}) as { label?: unknown };
      return normalizeSubflowName(nodeData.label) === normalizedName;
    });

    const hasPaletteConflict =
      isNameTaken(name) ||
      subflowTemplates.some(
        (template) => normalizeSubflowName(template.name) === normalizedName,
      );

    if (hasCanvasConflict || hasPaletteConflict) {
      setCreateSubflowNameError(
        "Ya existe un subflujo con ese nombre en la paleta o en el canvas. Elige otro nombre.",
      );
      return;
    }

    setCreateSubflowNameError(null);

    const nextInCount = Math.max(
      1,
      Number.isFinite(pendingSubflowPorts.inCount)
        ? pendingSubflowPorts.inCount
        : 1,
    );
    const nextOutCount = Math.max(
      1,
      Number.isFinite(pendingSubflowPorts.outCount)
        ? pendingSubflowPorts.outCount
        : 1,
    );

    const snapshotNodes = Array.isArray(pendingSubflowSnapshot.nodes)
      ? pendingSubflowSnapshot.nodes.slice()
      : [];
    const snapshotEdges = Array.isArray(pendingSubflowSnapshot.edges)
      ? pendingSubflowSnapshot.edges.slice()
      : [];

    const hasInputNode = snapshotNodes.some(
      (n) => String(n.type) === "subflowInput",
    );
    const hasOutputNode = snapshotNodes.some(
      (n) => String(n.type) === "subflowOutput",
    );

    if (!hasInputNode) {
      snapshotNodes.push({
        id: createNodeId(),
        type: "subflowInput",
        position: { x: 40, y: 40 },
        data: { label: "Entrada 1" },
      } as FlowNode);
    }
    if (!hasOutputNode) {
      snapshotNodes.push({
        id: createNodeId(),
        type: "subflowOutput",
        position: { x: 260, y: 40 },
        data: { label: "Salida" },
      } as FlowNode);
    }

    const maxIndex = nodes.reduce((max, n) => {
      const match = String(n.id).match(/^sf-(\d+)$/);
      const idx = match ? parseInt(match[1] ?? "0", 10) : 0;
      return Math.max(max, idx);
    }, 0);
    const next = maxIndex + 1;

    const x = pendingSubflowBounds.x + pendingSubflowBounds.width / 2 - 72;
    const y = pendingSubflowBounds.y - 90;

    const templateId = `sf-${next}`;

    // Recolectar los templateIds de subflujos referenciados dentro del
    // snapshot. Cualquiera de ellos puede ser la "llamada recursiva" cuando
    // el usuario está redefiniendo una plantilla existente.
    const candidateRecursiveTemplateIds = new Set<string>();
    for (const n of snapshotNodes) {
      if (String(n.type) !== "subflow") continue;
      const data =
        n.data && typeof n.data === "object"
          ? (n.data as Record<string, unknown>)
          : {};
      const tplId = data.templateId;
      if (typeof tplId === "string" && tplId.trim()) {
        candidateRecursiveTemplateIds.add(tplId.trim());
      }
    }
    // El nuevo id también es candidato (por si algún nodo ya lo referencia).
    candidateRecursiveTemplateIds.add(templateId);

    // Validación externa (ej. nivel 4: recursión de cola obligatoria).
    if (onValidateSubflow) {
      const validationError = onValidateSubflow(
        templateId,
        snapshotNodes as FlowNode[],
        snapshotEdges as FlowEdge[],
        candidateRecursiveTemplateIds,
      );
      if (validationError) {
        setCreateSubflowError(validationError);
        return;
      }
    }

    setNodes((prev) => {
      const newNode: FlowNode = {
        id: templateId,
        position: {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
        },
        data: {
          label: name,
          inCount: nextInCount,
          outCount: nextOutCount,
          subflowNodes: snapshotNodes,
          subflowEdges: snapshotEdges,
          templateId,
        },
        type: "subflow",
      };

      const removedIds = new Set(snapshotNodes.map((n) => String(n.id)));
      const remaining = prev.filter((n) => !removedIds.has(String(n.id)));
      return [...remaining, newNode];
    });

    if (addSubflowToPalette) {
      addOrUpdateTemplate({
        id: templateId,
        name,
        inCount: nextInCount,
        outCount: nextOutCount,
        nodes: snapshotNodes,
        edges: snapshotEdges,
      });
    }

    setEdges((prevEdges) =>
      prevEdges.filter((e) => {
        const src = String(e.source);
        const tgt = String(e.target);
        return (
          !snapshotNodes.some((n) => String(n.id) === src) &&
          !snapshotNodes.some((n) => String(n.id) === tgt)
        );
      }),
    );

    setIsCreateSubflowOpen(false);
    setPendingSubflowBounds(null);
    setPendingSubflowPorts(null);
    setPendingSubflowSnapshot(null);
  }, [
    addSubflowToPalette,
    addOrUpdateTemplate,
    isNameTaken,
    normalizeSubflowName,
    nodes,
    onValidateSubflow,
    pendingSubflowBounds,
    pendingSubflowPorts,
    pendingSubflowSnapshot,
    setNodes,
    setEdges,
    subflowTemplates,
    subflowName,
  ]);

  const requestDeleteTemplate = useCallback(
    (templateId: string) => {
      const match = subflowTemplates.find((tpl) => tpl.id === templateId);
      setPendingDeleteTemplateId(templateId);
      setPendingDeleteTemplateName(match ? match.name : null);
    },
    [subflowTemplates],
  );

  const cancelDeleteTemplate = useCallback(() => {
    setPendingDeleteTemplateId(null);
    setPendingDeleteTemplateName(null);
  }, []);

  const confirmDeleteTemplate = useCallback(() => {
    if (pendingDeleteTemplateId) {
      deleteTemplate(pendingDeleteTemplateId);
    }
    setPendingDeleteTemplateId(null);
    setPendingDeleteTemplateName(null);
  }, [deleteTemplate, pendingDeleteTemplateId]);

  return {
    isCreateSubflowOpen,
    onCreateSubflowDialogChange,
    openCreateSubflow,
    createSubflow,
    createSubflowError,
    pendingSubflowPorts,
    subflowName,
    setSubflowName: (value: string) => {
      setSubflowName(value);
      setCreateSubflowNameError(null);
    },
    createSubflowNameError,
    addSubflowToPalette,
    setAddSubflowToPalette: (checked: boolean) => {
      setAddSubflowToPalette(checked);
      setCreateSubflowNameError(null);
    },
    canSaveSubflow:
      !!subflowName.trim() &&
      !!pendingSubflowBounds &&
      !!pendingSubflowPorts &&
      !(addSubflowToPalette && !!createSubflowNameError),

    pendingDeleteTemplateId,
    pendingDeleteTemplateName,
    requestDeleteTemplate,
    cancelDeleteTemplate,
    confirmDeleteTemplate,
  };
}
