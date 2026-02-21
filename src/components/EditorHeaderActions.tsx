import { Download, Upload, Unplug, Plug, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EdgeFeedbackMode } from "@/flow/edge-feedback-mode";

interface EditorHeaderActionsProps {
  onDownloadClick: () => void;
  onLoadClick: () => void;
  onConnectClick: () => void;
  isConnected: boolean;
  edgeFeedbackMode: EdgeFeedbackMode;
  onToggleEdgeFeedbackMode: () => void;
}

export function EditorHeaderActions({
  onDownloadClick,
  onLoadClick,
  onConnectClick,
  isConnected,
  edgeFeedbackMode,
  onToggleEdgeFeedbackMode,
}: EditorHeaderActionsProps) {
  return (
    <>
      <Button
        variant="secondary"
        className="bg-transparent text-white hover:bg-white/10"
        type="button"
        onClick={onDownloadClick}
      >
        Descargar
        <Download className="text-white" />
      </Button>
      <Button
        variant="secondary"
        className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
        type="button"
        onClick={onLoadClick}
      >
        Cargar
        <Upload className="text-white" />
      </Button>
      <Button
        variant="secondary"
        className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
        type="button"
        onClick={onConnectClick}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${isConnected ? "bg-green-300" : "bg-white/40"}`}
          aria-hidden="true"
        />
        Conectar
        {isConnected ? (
          <Plug className="text-white" />
        ) : (
          <Unplug className="text-white" />
        )}
      </Button>
      <Button
        variant="secondary"
        className="bg-transparent text-white hover:bg-white/10 disabled:bg-gray-300 disabled:text-gray-600"
        type="button"
        onClick={onToggleEdgeFeedbackMode}
      >
        Mostrar valores
        {edgeFeedbackMode === "transient" ? (
          <Unlock className="ml-2 text-white" />
        ) : (
          <Lock className="ml-2 text-white" />
        )}
      </Button>
    </>
  );
}
