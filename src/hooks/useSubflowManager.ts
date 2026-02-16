import { useCallback, useState } from "react";
import type {
  FlowBounds,
  FlowEdge,
  FlowNode,
  SubflowSnapshot,
} from "@/utils/flow";
import type { CreateSubflowRequest } from "@/components/CreateSubflowOverlay";

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

    if (addSubflowToPalette && isNameTaken(name)) {
      setCreateSubflowNameError(
        "Ya existe un subflujo en la paleta con ese nombre. Elige otro nombre.",
      );
      return;
    }

    setCreateSubflowNameError(null);

    const maxIndex = nodes.reduce((max, n) => {
      const match = String(n.id).match(/^sf-(\d+)$/);
      const idx = match ? parseInt(match[1] ?? "0", 10) : 0;
      return Math.max(max, idx);
    }, 0);
    const next = maxIndex + 1;

    const x = pendingSubflowBounds.x + pendingSubflowBounds.width / 2 - 72;
    const y = pendingSubflowBounds.y - 90;

    const templateId = `sf-${next}`;

    setNodes((prev) => {
      const newNode: FlowNode = {
        id: templateId,
        position: {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
        },
        data: {
          label: name,
          inCount: pendingSubflowPorts.inCount,
          outCount: pendingSubflowPorts.outCount,
          subflowNodes: pendingSubflowSnapshot.nodes,
          subflowEdges: pendingSubflowSnapshot.edges,
          templateId,
        },
        type: "subflow",
      };

      const removedIds = new Set(
        pendingSubflowSnapshot.nodes.map((n) => String(n.id)),
      );
      const remaining = prev.filter((n) => !removedIds.has(String(n.id)));
      return [...remaining, newNode];
    });

    if (addSubflowToPalette) {
      addOrUpdateTemplate({
        id: templateId,
        name,
        inCount: pendingSubflowPorts.inCount,
        outCount: pendingSubflowPorts.outCount,
        nodes: pendingSubflowSnapshot.nodes,
        edges: pendingSubflowSnapshot.edges,
      });
    }

    setEdges((prevEdges) =>
      prevEdges.filter((e) => {
        const src = String(e.source);
        const tgt = String(e.target);
        return (
          !pendingSubflowSnapshot.nodes.some((n) => String(n.id) === src) &&
          !pendingSubflowSnapshot.nodes.some((n) => String(n.id) === tgt)
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
    nodes,
    pendingSubflowBounds,
    pendingSubflowPorts,
    pendingSubflowSnapshot,
    setNodes,
    setEdges,
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
