import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  SelectionMode,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/App.css";
import AppHeader from "@/components/app-header";
import { nodeTypes } from "@/flow/node-types";
import { LabeledEdge } from "@/flow/labeled-edge";
import { ArrowConnectionLine } from "@/flow/arrow-connection-line";
import { ConnectionErrorTooltip } from "@/flow/connection-error-tooltip";
import { ConnectionHighlightProvider } from "@/flow/connection-highlight-context";
import { AppSidebar } from "@/components/app-sidebar";
import { AbstractionLevelChangeDialog } from "@/components/AbstractionLevelChangeDialog";
import { CanvasContextMenu } from "@/components/CanvasContextMenu";
import { ChallengePanel } from "@/components/ChallengePanel";
import LevelCompleteDialog from "@/components/LevelCompleteDialog";
import { ConsolePanel } from "@/components/ConsolePanel";
import { CreateSubflowDialog } from "@/components/CreateSubflowDialog";
import { DeleteSubflowDialog } from "@/components/DeleteSubflowDialog";
import { TopBar } from "@/components/TopBar";
import { TopActionPanel } from "@/components/TopActionPanel";
import { EditorCanvasControls } from "@/components/EditorCanvasControls";
import { EditorHeaderActions } from "@/components/EditorHeaderActions";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { usePaletteDrag } from "@/hooks/usePaletteDrag";
import { SubflowTemplateContext } from "@/flow/subflow-templates-context";
import { useEngineRunner } from "@/hooks/useEngineRunner";
import { createNodeId } from "@/utils/id";
import { useFlowHistory } from "@/hooks/useFlowHistory";
import { useProgramIO } from "@/hooks/useProgramIO";
import { useRuntimeConsole } from "@/hooks/useRuntimeConsole";
import { useConnections } from "@/hooks/useConnections";
import { useClipboardSelection } from "@/hooks/useClipboardSelection";
import { useWriteNodeReconciliation } from "@/hooks/useWriteNodeReconciliation";
import { useSubflowTemplates } from "@/hooks/useSubflowTemplates";
import { useWsRunnerBridge } from "@/hooks/useWsRunnerBridge";
import { useChallengeManager } from "@/hooks/useChallengeManager";
import { useSubflowManager } from "@/hooks/useSubflowManager";
import { useNodeEdgeHandlers } from "@/hooks/useNodeEdgeHandlers";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useEditorViewport } from "@/hooks/useEditorViewport";
import { isMainCanvasNodeCreationLocked } from "@/hooks/useSubcanvasNodeCreationLock";
import { RemoteControllerPanel } from "@/components/RemoteControllerPanel";
import { RemoteSettingsDialog } from "@/components/RemoteSettingsDialog";
import type { EngineRunnerEvent } from "@/hooks/useEngineRunner";
import { useRemoteConfigState } from "@/hooks/useRemoteConfig";
import type { RemoteExecutor } from "@/engine/deserialize-program";
import { RemoteControllersProvider } from "@/ws/remote-controllers-context";
import {
  DEFAULT_ENGINE_SPEED_ID,
  ENGINE_SPEED_OPTIONS,
  getEngineSpeedOption,
} from "@/engine/engine-speed";
import {
  setEdgeFeedbackMode as setEdgeFeedbackModeGlobal,
  type EdgeFeedbackMode,
} from "@/flow/edge-feedback-mode";
import { isSoundEnabled } from "@/lib/sound";
import {
  isNodeVisibleInLevel,
  type AbstractionLevel,
  type NodePaletteCategory,
  type NodePaletteItem,
} from "@/flow/node-palette";
import { type FlowEdge, type FlowNode } from "@/utils/flow";
import { editorPaletteLabelByType } from "@/flow/editor-node-factory";
import { getLayoutedElements } from "@/utils/layout";
import { CreateSubflowOverlay } from "@/components/CreateSubflowOverlay";
import { useWindowSize } from "react-use";
import Confetti from "react-confetti";
import { getStoredAuthToken, getStoredAuthUser } from "@/lib/auth";
import { toast } from "sonner";
import { PublishProjectDialog } from "@/components/projects/PublishProjectDialog";
import {
  captureProjectThumbnail,
  fetchPublishedProjectById,
  getStoredGuestProjectAuthorName,
  persistGuestProjectAuthorName,
  publishProject,
  updatePublishedProject,
} from "@/lib/projects";
import { buildProhibitedTermsError } from "@/lib/content-moderation";
import {
  deserializeProgram,
  serializeProgram,
  type SerializedProgramV1,
} from "@/flow/serialization";
import { useSharedEdgeConfig } from "@/hooks/useSharedEdgeConfig";
import {
  buildUnsavedChangesSignature,
  useUnsavedChangesGuard,
} from "@/hooks/useUnsavedChangesGuard";
import { UploadCloud } from "lucide-react";
import type { AuthSessionUser } from "@/types";
import { Button } from "@/components/ui/button";
import {
  fetchExtensionById,
  type ExtensionListItem,
  type ExtensionNodeSummary,
} from "@/lib/extensions";
import { useConnectedMicrobitDevices } from "@/microbit/use-microbit-slot";
import microbitExample from "@/examples/microbit-example.json";
import distributionExample from "@/examples/distribution-example.json";
import dataflowExample from "@/examples/dataflow-example.json";

const initialNodes: FlowNode[] = [];
const initialEdges: FlowEdge[] = [];
const LEGACY_CUSTOM_NODE_REFERENCES_KEY = "nodi-custom-node-references-v1";
const EXTENSION_REFERENCES_KEY = "nodi-extension-references-v1";

type SavedCustomNodeReference = {
  id: string;
  name: string;
  authorName?: string;
  inCount: number;
  outCount: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

type SavedExtensionReference = {
  id: string;
  name: string;
  color: string;
  authorName: string;
  templateIds: string[];
};

type AbstractionRemovalCandidate = {
  type: string;
  label: string;
};

function parseSavedLegacyCustomNodeReferences(): SavedCustomNodeReference[] {
  try {
    const raw = localStorage.getItem(LEGACY_CUSTOM_NODE_REFERENCES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is SavedCustomNodeReference => {
      return (
        !!entry &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        typeof entry.inCount === "number" &&
        typeof entry.outCount === "number" &&
        Array.isArray(entry.nodes) &&
        Array.isArray(entry.edges)
      );
    });
  } catch {
    return [];
  }
}

function parseSavedExtensionReferences(): SavedExtensionReference[] {
  try {
    const raw = localStorage.getItem(EXTENSION_REFERENCES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is SavedExtensionReference => {
        const templateIds = Array.isArray(entry?.templateIds)
          ? entry.templateIds.filter(
              (value: unknown): value is string => typeof value === "string",
            )
          : [];

        return (
          !!entry &&
          typeof entry.id === "string" &&
          typeof entry.name === "string" &&
          typeof entry.color === "string" &&
          typeof entry.authorName === "string" &&
          Array.isArray(templateIds)
        );
      })
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        color: entry.color,
        authorName: entry.authorName,
        templateIds: Array.isArray(entry.templateIds)
          ? entry.templateIds.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
      }));
  } catch {
    return [];
  }
}

function parseNodeTemplate(customNode: {
  id: string;
  name: string;
  code: string;
  authorName?: string;
}) {
  const parsed = JSON.parse(customNode.code) as {
    label?: unknown;
    inCount?: unknown;
    outCount?: unknown;
    templateId?: unknown;
    subflowNodes?: unknown;
    subflowEdges?: unknown;
  };

  const nodes = Array.isArray(parsed.subflowNodes)
    ? (parsed.subflowNodes as FlowNode[])
    : [];
  const edges = Array.isArray(parsed.subflowEdges)
    ? (parsed.subflowEdges as FlowEdge[])
    : [];
  const inCount =
    typeof parsed.inCount === "number" && Number.isFinite(parsed.inCount)
      ? Math.max(0, Math.floor(parsed.inCount))
      : 0;
  const outCount =
    typeof parsed.outCount === "number" && Number.isFinite(parsed.outCount)
      ? Math.max(0, Math.floor(parsed.outCount))
      : 0;

  const templateId =
    typeof parsed.templateId === "string" && parsed.templateId.trim()
      ? parsed.templateId
      : customNode.id;

  const name =
    typeof parsed.label === "string" && parsed.label.trim()
      ? parsed.label.trim()
      : customNode.name;

  return {
    templateId,
    name,
    inCount,
    outCount,
    nodes,
    edges,
  };
}

function extractTemplateId(customNode: {
  id: string;
  name: string;
  code: string;
  authorName?: string;
}): string | null {
  try {
    return parseNodeTemplate(customNode).templateId;
  } catch {
    return null;
  }
}

const INITIAL_PROJECT_SAVE_SIGNATURE = buildUnsavedChangesSignature({
  name: "Sin título",
  description: "",
  program: serializeProgram({
    nodes: initialNodes,
    edges: initialEdges,
    programName: "Sin título",
  }),
});

export default function EditorPage() {
  const { challengeId } = useParams<{ challengeId?: string }>();
  const navigate = useNavigate();

  const {
    config: remoteConfig,
    setConfig: setRemoteConfig,
    resetConfig,
  } = useRemoteConfigState();
  const [isRemoteDialogOpen, setIsRemoteDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [publishDialogMode, setPublishDialogMode] = useState<
    "create-private" | "save-private" | "publish"
  >("create-private");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isGeneratingThumbnailPreview, setIsGeneratingThumbnailPreview] =
    useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [remixSourceProject, setRemixSourceProject] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [openedProjectRemixInfo, setOpenedProjectRemixInfo] = useState<{
    remixedFromId: string;
    remixedFromName: string | null;
  } | null>(null);
  const [authUser] = useState<AuthSessionUser | null>(() =>
    getStoredAuthUser(),
  );
  const [authToken] = useState<string | null>(() => getStoredAuthToken());
  const isAuthenticated = Boolean(authUser && authToken);
  const [projectDescription, setProjectDescription] = useState<string>("");
  const [guestAuthorName, setGuestAuthorName] = useState<string>(() =>
    getStoredGuestProjectAuthorName(),
  );

  const [edgeFeedbackMode, setEdgeFeedbackMode] =
    useState<EdgeFeedbackMode>("transient");
  const [engineSpeedId, setEngineSpeedId] = useState<string>(
    DEFAULT_ENGINE_SPEED_ID,
  );
  const engineSpeed = useMemo(
    () => getEngineSpeedOption(engineSpeedId),
    [engineSpeedId],
  );

  useEffect(() => {
    setEdgeFeedbackModeGlobal(edgeFeedbackMode);
  }, [edgeFeedbackMode]);

  const toggleEdgeFeedbackMode = useCallback(() => {
    setEdgeFeedbackMode((prev) =>
      prev === "transient" ? "persistent" : "transient",
    );
  }, []);

  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [canvasMode, setCanvasMode] = useState<"pan" | "select">("pan");
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [soundsEnabled, setSoundsEnabledState] = useState<boolean>(() =>
    isSoundEnabled(),
  );
  const [contextPoint, setContextPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isAbstractionLevelDialogOpen, setIsAbstractionLevelDialogOpen] =
    useState(false);
  const [abstractionRemovalCandidates, setAbstractionRemovalCandidates] =
    useState<AbstractionRemovalCandidate[]>([]);
  const [abstractionRemovalNodeIds, setAbstractionRemovalNodeIds] = useState<
    string[]
  >([]);
  const [pendingAbstractionLevel, setPendingAbstractionLevel] =
    useState<AbstractionLevel | null>(null);
  const pendingAbstractionLevelResolverRef = useRef<
    ((confirmed: boolean) => void) | null
  >(null);
  const hasHydratedExtensionsRef = useRef(false);

  const {
    subflowTemplates,
    addOrUpdateTemplate,
    isNameTaken,
    resolveTemplate,
    resolveTemplateByName,
    deleteTemplate,
  } = useSubflowTemplates();
  const [addedExtensionRefs, setAddedExtensionRefs] = useState<
    SavedExtensionReference[]
  >(() => parseSavedExtensionReferences());

  const existingExtensionIds = useMemo(
    () => addedExtensionRefs.map((extension) => extension.id),
    [addedExtensionRefs],
  );

  useEffect(() => {
    const saved = parseSavedLegacyCustomNodeReferences();
    if (!saved.length) return;

    for (const template of saved) {
      addOrUpdateTemplate({
        id: template.id,
        name: template.name,
        authorName: template.authorName,
        inCount: template.inCount,
        outCount: template.outCount,
        nodes: template.nodes,
        edges: template.edges,
      });
    }
  }, [addOrUpdateTemplate]);

  const addNodeSummaryToTemplateStore = useCallback(
    (
      customNode: Pick<
        ExtensionNodeSummary,
        "id" | "name" | "code" | "authorName"
      >,
      accentColor?: string,
      knownTemplateIds?: Set<string>,
    ) => {
      try {
        const parsed = parseNodeTemplate(customNode);
        const templateIds =
          knownTemplateIds ??
          new Set(subflowTemplates.map((template) => template.id));

        const isNewTemplate = !templateIds.has(parsed.templateId);

        addOrUpdateTemplate({
          id: parsed.templateId,
          name: parsed.name,
          authorName: customNode.authorName,
          accentColor: accentColor,
          inCount: parsed.inCount,
          outCount: parsed.outCount,
          nodes: parsed.nodes,
          edges: parsed.edges,
        });

        templateIds.add(parsed.templateId);
        return isNewTemplate;
      } catch {
        return false;
      }
    },
    [addOrUpdateTemplate, subflowTemplates],
  );

  const refreshExtensionInPalette = useCallback(
    async (extensionId: string) => {
      const details = await fetchExtensionById(extensionId);
      const knownTemplateIds = new Set(
        subflowTemplates.map((template) => template.id),
      );
      const extensionTemplateIds = new Set<string>();

      let addedCount = 0;
      for (const node of details.nodes) {
        const templateId = extractTemplateId(node);
        if (templateId) {
          extensionTemplateIds.add(templateId);
        }

        if (
          addNodeSummaryToTemplateStore(node, details.color, knownTemplateIds)
        ) {
          addedCount += 1;
        }
      }

      const nextTemplateIds = Array.from(extensionTemplateIds).sort();
      const nextRef: SavedExtensionReference = {
        id: details.id,
        name: details.name,
        color: details.color,
        authorName: details.authorName,
        templateIds: nextTemplateIds,
      };

      setAddedExtensionRefs((prev) => {
        const index = prev.findIndex((entry) => entry.id === details.id);

        if (index < 0) {
          const next = [...prev, nextRef];
          localStorage.setItem(EXTENSION_REFERENCES_KEY, JSON.stringify(next));
          return next;
        }

        const current = prev[index];
        const sameTemplateIds =
          current.templateIds.length === nextRef.templateIds.length &&
          current.templateIds.every(
            (templateId, idx) => templateId === nextRef.templateIds[idx],
          );
        const unchanged =
          current.name === nextRef.name &&
          current.color === nextRef.color &&
          current.authorName === nextRef.authorName &&
          sameTemplateIds;

        if (unchanged) {
          return prev;
        }

        const next = [...prev];
        next[index] = nextRef;
        localStorage.setItem(EXTENSION_REFERENCES_KEY, JSON.stringify(next));
        return next;
      });

      return {
        details,
        addedCount,
        totalCount: nextTemplateIds.length,
      };
    },
    [addNodeSummaryToTemplateStore, subflowTemplates],
  );

  const handleAddExtensionToPalette = useCallback(
    async (extension: ExtensionListItem) => {
      if (existingExtensionIds.includes(extension.id)) {
        try {
          const refreshed = await refreshExtensionInPalette(extension.id);
          toast.success(
            `Extensión actualizada: ${refreshed.totalCount} nodo(s) sincronizado(s).`,
          );
          return true;
        } catch {
          toast.error("No se pudo refrescar la extension en la paleta.");
          return false;
        }
      }

      try {
        const refreshed = await refreshExtensionInPalette(extension.id);

        if (refreshed.totalCount === 0) {
          toast.error("Esta extension no tiene nodos disponibles.");
          return false;
        }

        toast.success(
          `Se sincronizó ${refreshed.details.name} (${refreshed.totalCount} nodo(s)).`,
        );
        return true;
      } catch {
        toast.error("No se pudo agregar la extension a la paleta.");
        return false;
      }
    },
    [existingExtensionIds, refreshExtensionInPalette],
  );

  useEffect(() => {
    if (hasHydratedExtensionsRef.current) return;
    const savedExtensions = parseSavedExtensionReferences();
    if (!savedExtensions.length) {
      hasHydratedExtensionsRef.current = true;
      return;
    }

    hasHydratedExtensionsRef.current = true;

    let cancelled = false;

    const loadSavedExtensions = async () => {
      for (const extension of savedExtensions) {
        if (cancelled) return;
        try {
          await refreshExtensionInPalette(extension.id);
        } catch {
          // Ignore stale extension references from previous sessions.
        }
      }
    };

    loadSavedExtensions();

    return () => {
      cancelled = true;
    };
  }, [refreshExtensionInPalette]);

  useEffect(() => {
    if (!addedExtensionRefs.length) return;

    let disposed = false;

    const refreshAll = async () => {
      if (disposed || document.hidden) {
        return;
      }

      for (const extension of addedExtensionRefs) {
        if (disposed) return;
        try {
          await refreshExtensionInPalette(extension.id);
        } catch {
          // Best effort refresh; keep current palette state on failures.
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshAll();
    }, 15000);

    const onFocus = () => {
      void refreshAll();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refreshAll();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [addedExtensionRefs, refreshExtensionInPalette]);

  const [programName, setProgramName] = useState<string>("Sin título");

  const isRuntimeUpdateRef = useRef(false);
  const {
    undo,
    redo,
    onNodeDragStart,
    onNodeDragStop,
    isRestoringRef,
    isDraggingRef,
    resetHistory,
  } = useFlowHistory({
    nodes,
    edges,
    setNodes,
    setEdges,
    initialNodes,
    initialEdges,
    isRuntimeUpdateRef,
  });

  const { copySelection, pasteSelection, onPaneMouseMove } =
    useClipboardSelection({
      nodes,
      edges,
      setNodes,
      setEdges,
      reactFlowInstance,
    });

  const {
    consoleScrollRef,
    consoleInputRef,
    consoleOutputText,
    activeRuntimePrompt,
    runtimePromptInput,
    setRuntimePromptInput,
    onClearConsoleClick,
    onSubmitRuntimePrompt,
    onCancelRuntimePrompt,
    appendConsoleLines,
    enqueuePrompt,
    clearPromptQueue,
    getRuntimePromptText,
  } = useRuntimeConsole({ setNodes, isRuntimeUpdateRef });

  const engineEventSinkRef = useRef<
    ((event: EngineRunnerEvent) => void) | null
  >(null);
  const remoteExecutorRef = useRef<RemoteExecutor | null>(null);
  const onEngineEvent = useCallback((event: EngineRunnerEvent) => {
    engineEventSinkRef.current?.(event);
  }, []);
  const remoteExecutor = useCallback<RemoteExecutor>((req) => {
    if (!remoteExecutorRef.current) {
      return Promise.reject(new Error("Remote executor no disponible."));
    }
    return remoteExecutorRef.current(req);
  }, []);

  const { isEngineRunning, onRunClick, onStopClick } = useEngineRunner({
    nodes,
    edges,
    programName,
    reactFlowInstance,
    setNodes,
    isRuntimeUpdateRef,
    stepDelayMs: engineSpeed.delayMs,
    appendConsoleLines,
    enqueuePrompt,
    clearPromptQueue,
    onEngineEvent,
    remoteExecutor,
    resolveSubflowTemplate: resolveTemplate,
    maxSubflowDepth: 1000,
  });

  const runnerBridge = useWsRunnerBridge({
    remoteConfig,
    nodes,
    programName,
    isEngineRunning,
    activeRuntimePrompt,
    onRunClick,
    onStopClick,
  });

  const connectedMicrobitDevices = useConnectedMicrobitDevices();

  const connectedDevices = useMemo(() => {
    const wsDevices = runnerBridge.controllers.map((controller) => ({
      id: controller.id,
      name: controller.name,
      kind: "pc" as const,
    }));

    const microbitDevices = connectedMicrobitDevices.map((device) => ({
      id: `microbit-slot-${device.slot}`,
      name: device.deviceLabel
        ? `${device.deviceLabel} (micro:bit #${device.slot})`
        : `micro:bit #${device.slot}`,
      kind: "microbit" as const,
    }));

    return [...microbitDevices, ...wsDevices];
  }, [connectedMicrobitDevices, runnerBridge.controllers]);

  useEffect(() => {
    engineEventSinkRef.current = runnerBridge.emitEngineEvent;
    remoteExecutorRef.current = runnerBridge.executeRemote;
  }, [runnerBridge.emitEngineEvent, runnerBridge.executeRemote]);

  const handleRunClick = useCallback(() => {
    setIsConsoleOpen(true);
    return onRunClick();
  }, [onRunClick]);

  const challenge = useChallengeManager({
    challengeId,
    nodes,
    edges,
    programName,
    remoteExecutorRef,
    resolveSubflowTemplate: resolveTemplate,
    setNodes,
    setEdges,
    setProgramName,
    resetHistory,
    onClearConsoleClick,
    clearPromptQueue,
    setIsConsoleOpen,
    consoleOutputText,
  });

  useEffect(() => {
    if (!challengeId) {
      const searchParams = new URLSearchParams(window.location.search);
      const demoParam = searchParams.get("demo");

      if (
        demoParam === "microbit" ||
        demoParam === "distribution" ||
        demoParam === "dataflow"
      ) {
        const exampleData =
          demoParam === "microbit"
            ? microbitExample
            : demoParam === "distribution"
              ? distributionExample
              : dataflowExample;
        const deserialized = deserializeProgram(
          exampleData as SerializedProgramV1,
        );

        setNodes(deserialized.nodes as FlowNode[]);
        setEdges(deserialized.edges as FlowEdge[]);
        setProgramName(
          deserialized.programName ||
            (demoParam === "microbit"
              ? "Demo Micro:bit"
              : demoParam === "distribution"
                ? "Demo Distribución"
                : "Demo Dataflow"),
        );

        resetHistory({
          nodes: deserialized.nodes as FlowNode[],
          edges: deserialized.edges as FlowEdge[],
        });

        if (reactFlowInstance) {
          requestAnimationFrame(() => {
            reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
          });
        }
        return;
      }
      return;
    }
  }, [
    challengeId,
    setNodes,
    setEdges,
    setProgramName,
    resetHistory,
    reactFlowInstance,
  ]);

  const shouldLoadPublishedProject = Boolean(
    challengeId &&
    !challenge.isChallengeLoading &&
    !challenge.challengeDefinition,
  );

  const publishedProjectQuery = useQuery({
    queryKey: ["projects", "detail", challengeId],
    queryFn: () => fetchPublishedProjectById(challengeId as string),
    enabled: shouldLoadPublishedProject,
  });

  const publishProjectMutation = useMutation({
    mutationFn: publishProject,
  });

  const updatePublishedProjectMutation = useMutation({
    mutationFn: updatePublishedProject,
  });

  const { editorContainerRef, sidebarTop } = useEditorViewport({
    challengeDefinition: challenge.challengeDefinition,
    reactFlowInstance,
  });

  const generateThumbnailPreview = useCallback(async () => {
    const flowElement =
      editorContainerRef.current?.querySelector(".react-flow");

    if (!(flowElement instanceof HTMLElement)) {
      setThumbnailPreview(null);
      return null;
    }

    const waitForPaint = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

    const edgePaths = Array.from(
      flowElement.querySelectorAll<SVGPathElement>(".react-flow__edge-path"),
    );
    const restoreEdgeStyles = edgePaths.map((path) => ({
      path,
      strokeAttr: path.getAttribute("stroke"),
      strokeWidthAttr: path.getAttribute("stroke-width"),
      stroke: path.style.stroke,
      strokeWidth: path.style.strokeWidth,
      strokeOpacity: path.style.strokeOpacity,
    }));

    const previousViewport = reactFlowInstance?.getViewport() ?? null;

    try {
      await waitForPaint();

      if (reactFlowInstance && nodes.length > 0) {
        await reactFlowInstance.fitView({
          padding: 0.18,
          duration: 0,
          minZoom: 1.75,
          maxZoom: 1.75,
        });
        await waitForPaint();
      }

      for (const item of restoreEdgeStyles) {
        const computed = getComputedStyle(item.path);
        const computedStroke = computed.stroke;
        const computedStrokeWidth = computed.strokeWidth;
        const stroke =
          computedStroke &&
          computedStroke !== "none" &&
          computedStroke !== "transparent" &&
          computedStroke !== "rgba(0, 0, 0, 0)"
            ? computedStroke
            : "#64748b";

        item.path.setAttribute("stroke", stroke);
        item.path.style.stroke = stroke;

        if (
          computedStrokeWidth &&
          computedStrokeWidth !== "0px" &&
          computedStrokeWidth !== "0"
        ) {
          item.path.setAttribute("stroke-width", computedStrokeWidth);
          item.path.style.strokeWidth = computedStrokeWidth;
        }
      }

      await waitForPaint();

      const thumbnail = await captureProjectThumbnail(flowElement, {
        filter: (node) => {
          if (!(node instanceof HTMLElement)) {
            return true;
          }

          return !node.closest('[data-thumbnail-hidden="true"]');
        },
      });
      setThumbnailPreview(thumbnail);
      return thumbnail;
    } finally {
      for (const item of restoreEdgeStyles) {
        if (item.strokeAttr === null) {
          item.path.removeAttribute("stroke");
        } else {
          item.path.setAttribute("stroke", item.strokeAttr);
        }

        if (item.strokeWidthAttr === null) {
          item.path.removeAttribute("stroke-width");
        } else {
          item.path.setAttribute("stroke-width", item.strokeWidthAttr);
        }

        item.path.style.stroke = item.stroke;
        item.path.style.strokeWidth = item.strokeWidth;
        item.path.style.strokeOpacity = item.strokeOpacity;
      }

      if (reactFlowInstance && previousViewport) {
        await reactFlowInstance.setViewport(previousViewport, { duration: 0 });
      }
    }
  }, [editorContainerRef, reactFlowInstance, nodes.length]);

  const canEditPublishedProject = Boolean(
    publishedProjectQuery.data?.viewerCanEdit,
  );
  const currentProgramSnapshot = useMemo(
    () =>
      serializeProgram({
        nodes,
        edges,
        viewport: reactFlowInstance?.getViewport(),
        programName,
      }),
    [nodes, edges, reactFlowInstance, programName],
  );
  const currentSaveSignature = useMemo(
    () =>
      buildUnsavedChangesSignature({
        name: programName,
        description: projectDescription,
        program: currentProgramSnapshot,
      }),
    [currentProgramSnapshot, programName, projectDescription],
  );
  const leaveWarningMessage =
    "Tienes cambios sin guardar. Si sales de esta vista, se perderán.";
  const { confirmLeaveIfNeeded, markAsSaved } = useUnsavedChangesGuard({
    enabled: !challenge.challengeDefinition,
    currentSignature: currentSaveSignature,
    initialSavedSignature: INITIAL_PROJECT_SAVE_SIGNATURE,
    warningMessage: leaveWarningMessage,
  });

  const handleSaveChanges = useCallback(
    async (
      projectName: string,
      description: string,
      thumbnailOverride: string | null,
      nextGuestAuthorName: string,
    ) => {
      if (!publishedProjectQuery.data) {
        setPublishError("No hay un proyecto publicado cargado para guardar.");
        return;
      }

      const normalizedName = projectName.trim();
      if (!normalizedName) {
        setPublishError("Ingresa un nombre para el proyecto.");
        return;
      }

      const titleError = buildProhibitedTermsError(
        "El titulo del proyecto",
        normalizedName,
      );
      if (titleError) {
        setPublishError(titleError);
        return;
      }

      const descriptionError = buildProhibitedTermsError(
        "La descripcion del proyecto",
        description,
      );
      if (descriptionError) {
        setPublishError(descriptionError);
        return;
      }

      const normalizedGuestAuthorName = nextGuestAuthorName.trim();
      if (!reactFlowInstance) {
        setPublishError("El editor aún no está listo. Intenta de nuevo.");
        return;
      }

      setPublishError(null);

      try {
        const thumbnail =
          thumbnailOverride ??
          thumbnailPreview ??
          (await generateThumbnailPreview());
        if (!thumbnail) {
          throw new Error(
            "No se pudo generar la miniatura del proyecto. Intenta de nuevo.",
          );
        }

        const program = serializeProgram({
          nodes,
          edges,
          viewport: reactFlowInstance.getViewport(),
          programName: normalizedName,
        });

        await updatePublishedProjectMutation.mutateAsync({
          id: publishedProjectQuery.data.id,
          name: normalizedName,
          description,
          thumbnail,
          program,
          isPublic: false,
          guestAuthorName: isAuthenticated
            ? undefined
            : normalizedGuestAuthorName || undefined,
        });

        setProgramName(normalizedName);
        setProjectDescription(description);
        if (!isAuthenticated) {
          persistGuestProjectAuthorName(normalizedGuestAuthorName);
          setGuestAuthorName(normalizedGuestAuthorName);
        }
        // refresh published project data
        try {
          await publishedProjectQuery.refetch();
        } catch {
          // ignore
        }

        // keep thumbnail preview in UI
        setThumbnailPreview(thumbnail);
        markAsSaved(
          buildUnsavedChangesSignature({
            name: normalizedName,
            description,
            program,
          }),
        );
        setIsPublishDialogOpen(false);
        toast.success("Proyecto guardado en privado.");
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo guardar el proyecto.";
        setPublishError(message);
        toast.error(message);
      }
    },
    [
      publishedProjectQuery,
      reactFlowInstance,
      thumbnailPreview,
      generateThumbnailPreview,
      nodes,
      edges,
      updatePublishedProjectMutation,
      isAuthenticated,
      markAsSaved,
    ],
  );

  useEffect(() => {
    const project = publishedProjectQuery.data;
    if (!project) return;

    const deserialized = deserializeProgram(project.program);
    setRemixSourceProject({ id: project.id, name: project.name });
    setOpenedProjectRemixInfo(
      project.remixedFromId
        ? {
            remixedFromId: project.remixedFromId,
            remixedFromName: project.remixedFromName,
          }
        : null,
    );
    setNodes(deserialized.nodes as FlowNode[]);
    setEdges(deserialized.edges as FlowEdge[]);
    setProgramName(project.name || project.program.programName || "Sin título");
    setProjectDescription(project.description ?? "");
    markAsSaved(
      buildUnsavedChangesSignature({
        name: project.name || project.program.programName || "Sin título",
        description: project.description ?? "",
        program: project.program,
      }),
    );
    if (
      !isAuthenticated &&
      project.authorKind === "guest" &&
      project.viewerCanEdit &&
      project.authorName.trim()
    ) {
      setGuestAuthorName(project.authorName.trim());
      persistGuestProjectAuthorName(project.authorName.trim());
    }
    resetHistory({
      nodes: deserialized.nodes as FlowNode[],
      edges: deserialized.edges as FlowEdge[],
    });

    if (deserialized.viewport && reactFlowInstance) {
      reactFlowInstance.setViewport(deserialized.viewport, { duration: 0 });
    }
  }, [
    publishedProjectQuery.data,
    reactFlowInstance,
    resetHistory,
    setEdges,
    setNodes,
    setProgramName,
    isAuthenticated,
    markAsSaved,
  ]);

  useEffect(() => {
    if (!publishedProjectQuery.isError) return;
    setRemixSourceProject(null);
    setOpenedProjectRemixInfo(null);
    setProjectDescription("");
  }, [publishedProjectQuery.isError]);

  useEffect(() => {
    if (!challengeId || challenge.challengeDefinition) {
      setRemixSourceProject(null);
      setOpenedProjectRemixInfo(null);
      setProjectDescription("");
    }
  }, [challengeId, challenge.challengeDefinition]);

  const {
    paletteCategories: basePaletteCategories,
    onPaletteDragStart: onPaletteDragStartInternal,
    onDragOver,
    onDrop,
  } = usePaletteDrag({
    reactFlowInstance,
    setNodes,
    setEdges,
    subflowTemplates,
  });

  const paletteCategories = useMemo(() => {
    const extensionTemplateIdSet = new Set(
      addedExtensionRefs.flatMap((extension) => extension.templateIds),
    );

    const localSubflowItems = subflowTemplates
      .filter((template) => !extensionTemplateIdSet.has(template.id))
      .map<NodePaletteItem>((template) => ({
        type: "subflow",
        label: template.name,
        description: "Subflujo guardado",
        templateId: template.id,
      }));

    const builtInCategories = basePaletteCategories.map((category) => {
      if (category.id !== "abstraction") {
        return category;
      }

      return {
        ...category,
        items: [...category.items, ...localSubflowItems],
      };
    });

    const extensionCategories = addedExtensionRefs
      .map<NodePaletteCategory | null>((extension) => {
        const items: NodePaletteItem[] = [];
        for (const templateId of extension.templateIds) {
          const template = subflowTemplates.find(
            (item) => item.id === templateId,
          );
          if (!template) {
            continue;
          }

          items.push({
            type: "subflow",
            label: template.name,
            description: `Subflujo de ${extension.name}`,
            templateId: template.id,
            accentColor: extension.color,
          });
        }

        if (items.length === 0) {
          return null;
        }

        return {
          id: `extension-${extension.id}`,
          title: extension.name,
          accentColor: extension.color,
          items,
        };
      })
      .filter((category): category is NodePaletteCategory => category !== null);

    const mergedCategories = [...builtInCategories, ...extensionCategories];

    if (!challenge.challengeAllowSet) return mergedCategories;

    return mergedCategories
      .map((category) => {
        const items = (category.items ?? []).filter((item) =>
          challenge.challengeAllowSet!.has(item.type),
        );

        const subcategories = (category.subcategories ?? [])
          .map((sub) => {
            const subItems = (sub.items ?? []).filter((item) =>
              challenge.challengeAllowSet!.has(item.type),
            );
            return { ...sub, items: subItems };
          })
          .filter((s) => (s.items ?? []).length > 0);

        return { ...category, items, subcategories };
      })
      .filter(
        (category) =>
          (category.items ?? []).length > 0 ||
          (category.subcategories ?? []).length > 0,
      );
  }, [
    addedExtensionRefs,
    basePaletteCategories,
    challenge.challengeAllowSet,
    subflowTemplates,
  ]);

  const onPaletteDragStart = useCallback(
    (event: React.DragEvent | React.TouchEvent, item: NodePaletteItem) => {
      if (
        challenge.challengeAllowSet &&
        !challenge.challengeAllowSet.has(item.type)
      )
        return;
      onPaletteDragStartInternal(event, item);
    },
    [challenge.challengeAllowSet, onPaletteDragStartInternal],
  );

  const resolvePendingAbstractionLevelChange = useCallback(
    (confirmed: boolean) => {
      const resolver = pendingAbstractionLevelResolverRef.current;
      pendingAbstractionLevelResolverRef.current = null;
      resolver?.(confirmed);
    },
    [],
  );

  const closeAbstractionLevelDialog = useCallback(() => {
    setIsAbstractionLevelDialogOpen(false);
    setAbstractionRemovalCandidates([]);
    setAbstractionRemovalNodeIds([]);
    setPendingAbstractionLevel(null);
  }, []);

  const cancelAbstractionLevelChange = useCallback(() => {
    closeAbstractionLevelDialog();
    resolvePendingAbstractionLevelChange(false);
  }, [closeAbstractionLevelDialog, resolvePendingAbstractionLevelChange]);

  const confirmAbstractionLevelChange = useCallback(() => {
    const idsToRemove = new Set(abstractionRemovalNodeIds);

    if (idsToRemove.size > 0) {
      setNodes((prev) => prev.filter((node) => !idsToRemove.has(node.id)));
      setEdges((prev) =>
        prev.filter(
          (edge) =>
            !idsToRemove.has(String(edge.source)) &&
            !idsToRemove.has(String(edge.target)),
        ),
      );
    }

    closeAbstractionLevelDialog();
    resolvePendingAbstractionLevelChange(true);
  }, [
    abstractionRemovalNodeIds,
    closeAbstractionLevelDialog,
    resolvePendingAbstractionLevelChange,
    setEdges,
    setNodes,
  ]);

  const onAbstractionLevelChange = useCallback(
    (nextLevel: AbstractionLevel): boolean | Promise<boolean> => {
      const nodesToRemove = nodes.filter((node) => {
        const nodeType = String(node.type ?? "");
        return !isNodeVisibleInLevel(nodeType, nextLevel);
      });

      const idsToRemove = nodesToRemove.map((node) => node.id);
      const uniqueTypes = new Map<string, AbstractionRemovalCandidate>();
      for (const node of nodesToRemove) {
        const nodeType = String(node.type ?? "");
        if (uniqueTypes.has(nodeType)) {
          continue;
        }

        uniqueTypes.set(nodeType, {
          type: nodeType,
          label: (editorPaletteLabelByType.get(nodeType) ?? nodeType) || "Nodo",
        });
      }

      const candidates = Array.from(uniqueTypes.values());

      if (candidates.length === 0) {
        return true;
      }

      return new Promise<boolean>((resolve) => {
        pendingAbstractionLevelResolverRef.current?.(false);
        pendingAbstractionLevelResolverRef.current = resolve;
        setAbstractionRemovalCandidates(candidates);
        setAbstractionRemovalNodeIds(idsToRemove);
        setPendingAbstractionLevel(nextLevel);
        setIsAbstractionLevelDialogOpen(true);
      });
    },
    [nodes],
  );

  useEffect(() => {
    return () => {
      pendingAbstractionLevelResolverRef.current?.(false);
      pendingAbstractionLevelResolverRef.current = null;
    };
  }, []);

  const selectedNodes = useMemo(
    () => nodes.filter((node) => node.selected),
    [nodes],
  );

  const subflow = useSubflowManager({
    nodes,
    setNodes,
    setEdges,
    addOrUpdateTemplate,
    isNameTaken,
    deleteTemplate,
    subflowTemplates,
  });

  const { fileInputRef, onDownloadClick, onLoadClick, onProgramFileChange } =
    useProgramIO({
      reactFlowInstance,
      programName,
      setNodes,
      setEdges,
      setProgramName,
    });

  const { onNodesChange, onEdgesChange } = useNodeEdgeHandlers({
    setNodes,
    setEdges,
  });

  const {
    connectionTooltip,
    connectionHighlight,
    onConnectStart,
    onConnectEnd,
    onConnect,
  } = useConnections({ nodes, setNodes, setEdges });

  useWriteNodeReconciliation({
    edges,
    setNodes,
    setEdges,
    isRestoringRef,
    isRuntimeUpdateRef,
    isDraggingRef,
  });

  const pasteSelectionOnMainCanvas = useCallback(() => {
    if (isMainCanvasNodeCreationLocked()) {
      return;
    }

    pasteSelection();
  }, [pasteSelection]);

  useKeyboardShortcuts({
    undo,
    redo,
    copySelection,
    pasteSelection: pasteSelectionOnMainCanvas,
    setNodes,
    setEdges,
  });

  const addCommentAtContext = useCallback(() => {
    if (isMainCanvasNodeCreationLocked()) return;
    if (!reactFlowInstance) return;
    if (!contextPoint) return;

    const instance = reactFlowInstance as
      | (ReactFlowInstance & {
          screenToFlowPosition?: (pos: { x: number; y: number }) => {
            x: number;
            y: number;
          };
          project?: (pos: { x: number; y: number }) => {
            x: number;
            y: number;
          };
        })
      | null;

    const screenPos = { x: contextPoint.x, y: contextPoint.y };
    const position = instance?.screenToFlowPosition?.(screenPos) ??
      instance?.project?.(screenPos) ?? { x: 0, y: 0 };

    const newNode: FlowNode = {
      id: createNodeId(),
      type: "comment",
      position,
      data: { text: "" },
    };

    setNodes((prev) => [...prev, newNode]);
    setContextPoint(null);
  }, [reactFlowInstance, contextPoint, setNodes]);

  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
    );
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [nodes, edges, setNodes, setEdges]);

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const sharedEdgeConfig = useSharedEdgeConfig<FlowEdge>(setEdges);

  useEffect(() => {
    if (!isPublishDialogOpen) {
      return;
    }

    setIsGeneratingThumbnailPreview(true);
    generateThumbnailPreview()
      .catch(() => {
        setThumbnailPreview(null);
      })
      .finally(() => {
        setIsGeneratingThumbnailPreview(false);
      });
  }, [generateThumbnailPreview, isPublishDialogOpen, nodes, edges]);

  const handleCreatePrivateProject = useCallback(
    async (
      projectName: string,
      description: string,
      thumbnailOverride: string | null,
      nextGuestAuthorName: string,
      shouldPublishNow: boolean,
    ) => {
      const normalizedName = projectName.trim();
      if (!normalizedName) {
        setPublishError("Ingresa un nombre para el proyecto.");
        return;
      }

      const titleError = buildProhibitedTermsError(
        "El titulo del proyecto",
        normalizedName,
      );
      if (titleError) {
        setPublishError(titleError);
        return;
      }

      const descriptionError = buildProhibitedTermsError(
        "La descripcion del proyecto",
        description,
      );
      if (descriptionError) {
        setPublishError(descriptionError);
        return;
      }

      const normalizedGuestAuthorName = nextGuestAuthorName.trim();
      if (!isAuthenticated && shouldPublishNow && !normalizedGuestAuthorName) {
        setPublishError("Ingresa tu nombre para publicar sin iniciar sesión.");
        return;
      }

      if (!reactFlowInstance) {
        setPublishError("El editor aún no está listo. Intenta de nuevo.");
        return;
      }

      setPublishError(null);

      try {
        const thumbnail =
          thumbnailOverride ??
          thumbnailPreview ??
          (await generateThumbnailPreview());
        if (!thumbnail) {
          throw new Error(
            "No se pudo generar la miniatura del proyecto. Intenta de nuevo.",
          );
        }

        const program = serializeProgram({
          nodes,
          edges,
          viewport: reactFlowInstance.getViewport(),
          programName: normalizedName,
        });

        const createdProject = await publishProjectMutation.mutateAsync({
          name: normalizedName,
          description,
          thumbnail,
          isPublic: shouldPublishNow,
          remixedFrom: remixSourceProject?.id,
          program,
          guestAuthorName: isAuthenticated
            ? undefined
            : normalizedGuestAuthorName || undefined,
        });

        setProgramName(normalizedName);
        setProjectDescription(description);
        if (!isAuthenticated) {
          persistGuestProjectAuthorName(normalizedGuestAuthorName);
          setGuestAuthorName(normalizedGuestAuthorName);
        }
        const shouldNavigateToCreatedRemix =
          Boolean(remixSourceProject) &&
          typeof createdProject?.id === "string" &&
          createdProject.id.length > 0;

        markAsSaved(
          buildUnsavedChangesSignature({
            name: normalizedName,
            description,
            program,
          }),
        );

        if (shouldNavigateToCreatedRemix) {
          navigate(`/editor/${createdProject.id}`);
        }
        setIsPublishDialogOpen(false);
        toast.success(
          shouldPublishNow
            ? "Proyecto guardado y publicado."
            : "Proyecto guardado en privado.",
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo guardar el proyecto.";
        setPublishError(message);
        toast.error(message);
      }
    },
    [
      edges,
      generateThumbnailPreview,
      publishProjectMutation,
      isAuthenticated,
      nodes,
      reactFlowInstance,
      remixSourceProject,
      thumbnailPreview,
      navigate,
      markAsSaved,
    ],
  );

  const handlePublishProject = useCallback(
    async (
      projectName: string,
      description: string,
      thumbnailOverride: string | null,
      nextGuestAuthorName: string,
    ) => {
      if (!publishedProjectQuery.data || !canEditPublishedProject) {
        setPublishError("No hay un proyecto editable para publicar.");
        return;
      }

      const normalizedName = projectName.trim();
      if (!normalizedName) {
        setPublishError("Ingresa un nombre para el proyecto.");
        return;
      }

      const normalizedGuestAuthorName = nextGuestAuthorName.trim();
      if (!isAuthenticated && !normalizedGuestAuthorName) {
        setPublishError("Ingresa tu nombre para publicar sin iniciar sesión.");
        return;
      }

      if (!reactFlowInstance) {
        setPublishError("El editor aún no está listo. Intenta de nuevo.");
        return;
      }

      setPublishError(null);

      try {
        const thumbnail =
          thumbnailOverride ??
          thumbnailPreview ??
          (await generateThumbnailPreview());

        const program = serializeProgram({
          nodes,
          edges,
          viewport: reactFlowInstance.getViewport(),
          programName: normalizedName,
        });

        await updatePublishedProjectMutation.mutateAsync({
          id: publishedProjectQuery.data.id,
          name: normalizedName,
          description,
          thumbnail: thumbnail ?? undefined,
          isPublic: true,
          program,
          guestAuthorName: isAuthenticated
            ? undefined
            : normalizedGuestAuthorName,
        });

        setProgramName(normalizedName);
        setProjectDescription(description);
        if (!isAuthenticated) {
          persistGuestProjectAuthorName(normalizedGuestAuthorName);
          setGuestAuthorName(normalizedGuestAuthorName);
        }
        setThumbnailPreview(thumbnail ?? null);
        markAsSaved(
          buildUnsavedChangesSignature({
            name: normalizedName,
            description,
            program,
          }),
        );
        setIsPublishDialogOpen(false);
        await publishedProjectQuery.refetch();
        toast.success("Proyecto publicado correctamente.");
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo publicar el proyecto.";
        setPublishError(message);
        toast.error(message);
      }
    },
    [
      canEditPublishedProject,
      edges,
      generateThumbnailPreview,
      isAuthenticated,
      nodes,
      publishedProjectQuery,
      reactFlowInstance,
      thumbnailPreview,
      updatePublishedProjectMutation,
      markAsSaved,
    ],
  );

  return (
    <RemoteControllersProvider controllers={runnerBridge.controllers}>
      {challenge.shouldCelebrate && (
        <Confetti
          width={windowWidth - 5}
          height={windowHeight - 10}
          initialVelocityY={15}
        />
      )}

      <SidebarProvider>
        <div
          className="flex h-svh w-full flex-col"
          style={
            {
              ...(sidebarTop
                ? { "--sidebar-top": `${Math.max(0, sidebarTop)}px` }
                : {}),
            } as React.CSSProperties
          }
        >
          <AppHeader centerTitle={challenge.challengeDefinition?.title}>
            {openedProjectRemixInfo ? (
              <Link
                to={`/editor/${openedProjectRemixInfo.remixedFromId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
                  Remix
                  {openedProjectRemixInfo.remixedFromName
                    ? ` de ${openedProjectRemixInfo.remixedFromName}`
                    : ""}
                </span>
              </Link>
            ) : null}
            {!challenge.challengeDefinition &&
              (canEditPublishedProject ? (
                <>
                  <Button
                    variant="ghost"
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setPublishError(null);
                      setPublishDialogMode("save-private");
                      setThumbnailPreview(null);
                      setIsPublishDialogOpen(true);
                    }}
                  >
                    <UploadCloud size={16} />
                    Guardar cambios
                  </Button>

                  {!publishedProjectQuery.data?.isPublic ? (
                    <Button
                      variant="ghost"
                      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setPublishError(null);
                        setPublishDialogMode("publish");
                        setThumbnailPreview(null);
                        setIsPublishDialogOpen(true);
                      }}
                    >
                      <UploadCloud size={16} />
                      Publicar proyecto
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button
                  variant="ghost"
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setPublishError(null);
                    setPublishDialogMode("create-private");
                    setThumbnailPreview(null);
                    setIsPublishDialogOpen(true);
                  }}
                >
                  <UploadCloud size={16} />
                  Guardar proyecto
                </Button>
              ))}
            <EditorHeaderActions
              onDownloadClick={onDownloadClick}
              onLoadClick={onLoadClick}
              onConnectClick={() => setIsRemoteDialogOpen(true)}
              isConnected={runnerBridge.wsState.connected}
              connectedDevices={connectedDevices}
              edgeFeedbackMode={edgeFeedbackMode}
              onToggleEdgeFeedbackMode={toggleEdgeFeedbackMode}
            />
          </AppHeader>

          <div className="flex flex-1 min-h-0">
            <AppSidebar
              categories={paletteCategories}
              onDragStart={onPaletteDragStart}
              onAbstractionLevelChange={onAbstractionLevelChange}
              onDeleteTemplate={subflow.requestDeleteTemplate}
              onAddExtension={handleAddExtensionToPalette}
              existingExtensionIds={existingExtensionIds}
              showAbstractionFilter={!challenge.challengeAllowSet}
            />

            <SidebarInset>
              <div className="relative flex h-full w-full flex-col">
                <TopBar
                  programName={programName}
                  onProgramNameChange={setProgramName}
                />

                <div className="relative flex flex-1 min-h-0">
                  <div className="relative flex-1">
                    <RemoteSettingsDialog
                      config={remoteConfig}
                      onChange={setRemoteConfig}
                      onReset={resetConfig}
                      open={isRemoteDialogOpen}
                      setOpen={setIsRemoteDialogOpen}
                    />

                    {remoteConfig.role === "controller" ? (
                      <RemoteControllerPanel remoteConfig={remoteConfig} />
                    ) : null}

                    <SubflowTemplateContext.Provider
                      value={{
                        addOrUpdateTemplate,
                        isNameTaken,
                        resolveTemplate,
                        resolveTemplateByName,
                      }}
                    >
                      <ConnectionHighlightProvider value={connectionHighlight}>
                        <CanvasContextMenu
                          onContextMenu={(e: React.MouseEvent) => {
                            setContextPoint({ x: e.clientX, y: e.clientY });
                          }}
                          onAddComment={addCommentAtContext}
                          copySelection={copySelection}
                          pasteSelection={pasteSelectionOnMainCanvas}
                        >
                          <div
                            ref={editorContainerRef}
                            className="relative h-full w-full"
                            onTouchEnd={(e) => {
                              const touch = e.changedTouches[0];
                              onDrop({
                                clientX: touch.clientX,
                                clientY: touch.clientY,
                              });
                            }}
                          >
                            <ReactFlow
                              nodes={nodes}
                              edges={edges}
                              nodeTypes={nodeTypes}
                              edgeTypes={{ default: LabeledEdge }}
                              connectionLineComponent={ArrowConnectionLine}
                              isValidConnection={
                                connectionTooltip.isValidConnection
                              }
                              {...sharedEdgeConfig}
                              onInit={setReactFlowInstance}
                              onNodesChange={onNodesChange}
                              onEdgesChange={onEdgesChange}
                              onConnect={onConnect}
                              onConnectStart={onConnectStart}
                              onConnectEnd={onConnectEnd}
                              onDrop={onDrop}
                              onDragOver={onDragOver}
                              onNodeDragStart={onNodeDragStart}
                              onNodeDragStop={onNodeDragStop}
                              onPaneMouseMove={onPaneMouseMove}
                              panOnDrag={canvasMode === "pan"}
                              selectionOnDrag={canvasMode === "select"}
                              selectionMode={SelectionMode.Partial}
                              className={
                                canvasMode === "pan"
                                  ? "rf-mode-pan"
                                  : "rf-mode-select"
                              }
                              fitView={!challenge.challengeDefinition}
                              proOptions={{ hideAttribution: true }}
                            >
                              {challenge.challengeDefinition ? (
                                <div data-thumbnail-hidden="true">
                                  <ChallengePanel
                                    challengeDefinition={
                                      challenge.challengeDefinition
                                    }
                                    isChallengeOpen={challenge.isChallengeOpen}
                                    onToggle={() =>
                                      challenge.setIsChallengeOpen((s) => !s)
                                    }
                                    validationResult={
                                      challenge.validationResult
                                    }
                                    isValidating={challenge.isValidating}
                                    onValidate={
                                      challenge.validateChallengeOutput
                                    }
                                    nextChallenge={challenge.nextChallenge}
                                    onNextChallengeClick={
                                      challenge.onNextChallengeClick
                                    }
                                  />
                                </div>
                              ) : null}

                              <div data-thumbnail-hidden="true">
                                <ConnectionErrorTooltip
                                  open={connectionTooltip.tooltip.open}
                                  message={connectionTooltip.tooltip.message}
                                  x={connectionTooltip.tooltip.x}
                                  y={connectionTooltip.tooltip.y}
                                  onClose={connectionTooltip.hide}
                                />
                              </div>
                              <div data-thumbnail-hidden="true">
                                <CreateSubflowOverlay
                                  selectedNodes={selectedNodes}
                                  edges={edges}
                                  onCreateClick={subflow.openCreateSubflow}
                                />
                              </div>
                              <Background variant={BackgroundVariant.Dots} />

                              <div data-thumbnail-hidden="true">
                                <EditorCanvasControls
                                  canvasMode={canvasMode}
                                  onSetCanvasMode={setCanvasMode}
                                  soundsEnabled={soundsEnabled}
                                  onSoundsEnabledChange={setSoundsEnabledState}
                                  onDeleteNodes={() => {
                                    setNodes([]);
                                    onClearConsoleClick();
                                  }}
                                  onLayout={onLayout}
                                />
                              </div>

                              <div data-thumbnail-hidden="true">
                                <TopActionPanel
                                  nodesCount={nodes.length}
                                  isEngineRunning={isEngineRunning}
                                  onRunClick={handleRunClick}
                                  onStopClick={onStopClick}
                                  engineSpeedOptions={ENGINE_SPEED_OPTIONS}
                                  engineSpeedId={engineSpeedId}
                                  onEngineSpeedChange={setEngineSpeedId}
                                />
                              </div>

                              <div data-thumbnail-hidden="true">
                                <ConsolePanel
                                  consoleOutputText={consoleOutputText}
                                  activeRuntimePrompt={activeRuntimePrompt}
                                  getRuntimePromptText={getRuntimePromptText}
                                  runtimePromptInput={runtimePromptInput}
                                  setRuntimePromptInput={setRuntimePromptInput}
                                  onSubmitRuntimePrompt={onSubmitRuntimePrompt}
                                  onCancelRuntimePrompt={onCancelRuntimePrompt}
                                  onClearConsoleClick={onClearConsoleClick}
                                  consoleScrollRef={consoleScrollRef}
                                  consoleInputRef={consoleInputRef}
                                  isOpen={isConsoleOpen}
                                  onToggle={() =>
                                    setIsConsoleOpen((prev) => !prev)
                                  }
                                  editorContainerRef={editorContainerRef}
                                />
                              </div>

                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/json,.json"
                                className="hidden"
                                onChange={onProgramFileChange}
                              />
                            </ReactFlow>
                          </div>
                        </CanvasContextMenu>
                      </ConnectionHighlightProvider>
                    </SubflowTemplateContext.Provider>
                  </div>
                </div>

                <CreateSubflowDialog
                  open={subflow.isCreateSubflowOpen}
                  onOpenChange={subflow.onCreateSubflowDialogChange}
                  createSubflowError={subflow.createSubflowError}
                  pendingSubflowPorts={subflow.pendingSubflowPorts}
                  subflowName={subflow.subflowName}
                  onSubflowNameChange={subflow.setSubflowName}
                  createSubflowNameError={subflow.createSubflowNameError}
                  addSubflowToPalette={subflow.addSubflowToPalette}
                  onAddSubflowToPaletteChange={subflow.setAddSubflowToPalette}
                  canSave={subflow.canSaveSubflow}
                  onCancel={() => subflow.onCreateSubflowDialogChange(false)}
                  onSave={subflow.createSubflow}
                />
              </div>
            </SidebarInset>
          </div>
        </div>

        <DeleteSubflowDialog
          open={subflow.pendingDeleteTemplateId !== null}
          templateName={subflow.pendingDeleteTemplateName}
          onOpenChange={(open) => {
            if (!open) subflow.cancelDeleteTemplate();
          }}
          onCancel={subflow.cancelDeleteTemplate}
          onConfirm={subflow.confirmDeleteTemplate}
        />

        {pendingAbstractionLevel !== null ? (
          <AbstractionLevelChangeDialog
            open={isAbstractionLevelDialogOpen}
            targetLevel={pendingAbstractionLevel}
            nodesToRemove={abstractionRemovalCandidates}
            onOpenChange={(open) => {
              if (!open) {
                cancelAbstractionLevelChange();
              }
            }}
            onCancel={cancelAbstractionLevelChange}
            onConfirm={confirmAbstractionLevelChange}
          />
        ) : null}

        <LevelCompleteDialog
          open={challenge.isLevelCompleteDialogOpen}
          onOpenChange={challenge.setIsLevelCompleteDialogOpen}
          onGoHome={() => {
            if (!confirmLeaveIfNeeded()) {
              return;
            }
            challenge.navigate("/");
          }}
          onGoEditor={() => {
            if (!confirmLeaveIfNeeded()) {
              return;
            }
            setNodes([]);
            setEdges([]);
            setProgramName("Sin título");
            resetHistory({ nodes: [], edges: [] });
            challenge.setIsLevelCompleteDialogOpen(false);
            challenge.navigate("/editor");
          }}
        />

        <PublishProjectDialog
          open={isPublishDialogOpen}
          mode={publishDialogMode}
          isAuthenticated={isAuthenticated}
          defaultName={programName}
          defaultDescription={projectDescription}
          defaultGuestAuthorName={guestAuthorName}
          thumbnailPreview={thumbnailPreview}
          isGeneratingPreview={isGeneratingThumbnailPreview}
          remixSourceName={
            publishDialogMode === "create-private"
              ? (remixSourceProject?.name ?? null)
              : null
          }
          isPublishing={
            publishDialogMode === "create-private"
              ? publishProjectMutation.isPending
              : updatePublishedProjectMutation.isPending
          }
          error={publishError}
          onOpenChange={(open) => {
            setIsPublishDialogOpen(open);
            if (!open) {
              setPublishError(null);
              setThumbnailPreview(null);
            }
          }}
          onConfirm={(
            name,
            description,
            thumbnailOverride,
            nextGuestAuthorName,
            shouldPublishNow,
          ) => {
            if (publishDialogMode === "save-private") {
              void handleSaveChanges(
                name,
                description,
                thumbnailOverride,
                nextGuestAuthorName,
              );
              return;
            }

            if (publishDialogMode === "publish") {
              void handlePublishProject(
                name,
                description,
                thumbnailOverride,
                nextGuestAuthorName,
              );
              return;
            }

            void handleCreatePrivateProject(
              name,
              description,
              thumbnailOverride,
              nextGuestAuthorName,
              shouldPublishNow,
            );
          }}
        />
      </SidebarProvider>
    </RemoteControllersProvider>
  );
}
