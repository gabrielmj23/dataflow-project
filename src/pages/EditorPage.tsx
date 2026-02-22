import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  MarkerType,
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
import type { NodePaletteItem } from "@/flow/node-palette";
import { type FlowEdge, type FlowNode } from "@/utils/flow";
import { getLayoutedElements } from "@/utils/layout";
import { CreateSubflowOverlay } from "@/components/CreateSubflowOverlay";
import { useWindowSize } from "react-use";
import Confetti from "react-confetti";
import { getStoredAuthToken, getStoredAuthUser } from "@/lib/auth";
import { PublishProjectDialog } from "@/components/projects/PublishProjectDialog";
import {
  captureProjectThumbnail,
  fetchPublishedProjectById,
  publishProject,
} from "@/lib/projects";
import { deserializeProgram, serializeProgram } from "@/flow/serialization";
import { UploadCloud } from "lucide-react";
import type { AuthSessionUser } from "@/types";
import { Button } from "@/components/ui/button";

const initialNodes: FlowNode[] = [];
const initialEdges: FlowEdge[] = [];

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

  const {
    subflowTemplates,
    addOrUpdateTemplate,
    isNameTaken,
    resolveTemplate,
    deleteTemplate,
  } = useSubflowTemplates();

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
  ]);

  useEffect(() => {
    if (!publishedProjectQuery.isError) return;
    setRemixSourceProject(null);
    setOpenedProjectRemixInfo(null);
  }, [publishedProjectQuery.isError]);

  useEffect(() => {
    if (!challengeId || challenge.challengeDefinition) {
      setRemixSourceProject(null);
      setOpenedProjectRemixInfo(null);
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
    if (!challenge.challengeAllowSet) return basePaletteCategories;
    return basePaletteCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          challenge.challengeAllowSet!.has(item.type),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [basePaletteCategories, challenge.challengeAllowSet]);

  const onPaletteDragStart = useCallback(
    (event: React.DragEvent, item: NodePaletteItem) => {
      if (
        challenge.challengeAllowSet &&
        !challenge.challengeAllowSet.has(item.type)
      )
        return;
      onPaletteDragStartInternal(event, item);
    },
    [challenge.challengeAllowSet, onPaletteDragStartInternal],
  );

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

  useKeyboardShortcuts({
    undo,
    redo,
    copySelection,
    pasteSelection,
    setNodes,
    setEdges,
  });

  const addCommentAtContext = useCallback(() => {
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

  const { editorContainerRef, sidebarTop } = useEditorViewport({
    challengeDefinition: challenge.challengeDefinition,
    reactFlowInstance,
  });

  const { width: windowWidth, height: windowHeight } = useWindowSize();

  const generateThumbnailPreview = useCallback(async () => {
    const flowElement =
      editorContainerRef.current?.querySelector(".react-flow");

    if (!(flowElement instanceof HTMLElement)) {
      setThumbnailPreview(null);
      return null;
    }

    const thumbnail = await captureProjectThumbnail(flowElement);
    setThumbnailPreview(thumbnail);
    return thumbnail;
  }, [editorContainerRef]);

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

  const handlePublishProject = useCallback(
    async (projectName: string) => {
      const normalizedName = projectName.trim();
      if (!normalizedName) {
        setPublishError("Ingresa un nombre para el proyecto.");
        return;
      }

      if (!reactFlowInstance) {
        setPublishError("El editor aún no está listo. Intenta de nuevo.");
        return;
      }

      setPublishError(null);

      try {
        const thumbnail =
          thumbnailPreview ?? (await generateThumbnailPreview());
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
          thumbnail,
          remixedFrom: remixSourceProject?.id,
          program,
        });

        setProgramName(normalizedName);
        const shouldNavigateToCreatedRemix =
          Boolean(remixSourceProject) &&
          typeof createdProject?.id === "string" &&
          createdProject.id.length > 0;

        if (shouldNavigateToCreatedRemix) {
          navigate(`/editor/${createdProject.id}`);
        }

        setIsPublishDialogOpen(false);
      } catch (error: unknown) {
        setPublishError(
          error instanceof Error
            ? error.message
            : "No se pudo publicar el proyecto.",
        );
      }
    },
    [
      edges,
      generateThumbnailPreview,
      publishProjectMutation,
      nodes,
      reactFlowInstance,
      remixSourceProject,
      thumbnailPreview,
      navigate,
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
            {isAuthenticated && (
              <Button
                variant="ghost"
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setPublishError(null);
                  setThumbnailPreview(null);
                  setIsPublishDialogOpen(true);
                }}
              >
                <UploadCloud size={16} />
                Publicar proyecto
              </Button>
            )}
            <EditorHeaderActions
              onDownloadClick={onDownloadClick}
              onLoadClick={onLoadClick}
              onConnectClick={() => setIsRemoteDialogOpen(true)}
              isConnected={runnerBridge.wsState.connected}
              edgeFeedbackMode={edgeFeedbackMode}
              onToggleEdgeFeedbackMode={toggleEdgeFeedbackMode}
            />
          </AppHeader>

          <div className="flex flex-1 min-h-0">
            <AppSidebar
              categories={paletteCategories}
              onDragStart={onPaletteDragStart}
              onDeleteTemplate={subflow.requestDeleteTemplate}
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
                      }}
                    >
                      <ConnectionHighlightProvider value={connectionHighlight}>
                        <CanvasContextMenu
                          onContextMenu={(e: React.MouseEvent) => {
                            setContextPoint({ x: e.clientX, y: e.clientY });
                          }}
                          onAddComment={addCommentAtContext}
                          copySelection={copySelection}
                          pasteSelection={pasteSelection}
                        >
                          <div
                            ref={editorContainerRef}
                            className="relative h-full w-full"
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
                              defaultEdgeOptions={{
                                markerEnd: {
                                  type: MarkerType.ArrowClosed,
                                  width: 14,
                                  height: 14,
                                },
                              }}
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
                                <ChallengePanel
                                  challengeDefinition={
                                    challenge.challengeDefinition
                                  }
                                  isChallengeOpen={challenge.isChallengeOpen}
                                  onToggle={() =>
                                    challenge.setIsChallengeOpen((s) => !s)
                                  }
                                  validationResult={challenge.validationResult}
                                  isValidating={challenge.isValidating}
                                  onValidate={challenge.validateChallengeOutput}
                                  nextChallenge={challenge.nextChallenge}
                                  onNextChallengeClick={
                                    challenge.onNextChallengeClick
                                  }
                                />
                              ) : null}

                              <ConnectionErrorTooltip
                                open={connectionTooltip.tooltip.open}
                                message={connectionTooltip.tooltip.message}
                                x={connectionTooltip.tooltip.x}
                                y={connectionTooltip.tooltip.y}
                                onClose={connectionTooltip.hide}
                              />
                              <CreateSubflowOverlay
                                selectedNodes={selectedNodes}
                                edges={edges}
                                onCreateClick={subflow.openCreateSubflow}
                              />
                              <Background variant={BackgroundVariant.Dots} />

                              <EditorCanvasControls
                                canvasMode={canvasMode}
                                onSetCanvasMode={setCanvasMode}
                                soundsEnabled={soundsEnabled}
                                onSoundsEnabledChange={setSoundsEnabledState}
                                onLayout={onLayout}
                              />

                              <TopActionPanel
                                nodesCount={nodes.length}
                                isEngineRunning={isEngineRunning}
                                onRunClick={handleRunClick}
                                onStopClick={onStopClick}
                                engineSpeedOptions={ENGINE_SPEED_OPTIONS}
                                engineSpeedId={engineSpeedId}
                                onEngineSpeedChange={setEngineSpeedId}
                              />

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
                              />

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

        <LevelCompleteDialog
          open={challenge.isLevelCompleteDialogOpen}
          onOpenChange={challenge.setIsLevelCompleteDialogOpen}
          onGoHome={() => challenge.navigate("/")}
          onGoEditor={() => {
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
          defaultName={programName}
          thumbnailPreview={thumbnailPreview}
          isGeneratingPreview={isGeneratingThumbnailPreview}
          remixSourceName={remixSourceProject?.name ?? null}
          isPublishing={publishProjectMutation.isPending}
          error={publishError}
          onOpenChange={(open) => {
            setIsPublishDialogOpen(open);
            if (!open) {
              setPublishError(null);
              setThumbnailPreview(null);
            }
          }}
          onConfirm={handlePublishProject}
        />
      </SidebarProvider>
    </RemoteControllersProvider>
  );
}
