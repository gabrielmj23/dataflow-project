import { Download, Upload, Unplug, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EdgeFeedbackMode } from "@/flow/edge-feedback-mode";

interface EditorHeaderActionsProps {
  onDownloadClick: () => void;
  onLoadClick: () => void;
  onConnectClick: () => void;
  edgeFeedbackMode: EdgeFeedbackMode;
  onToggleEdgeFeedbackMode: () => void;
}

export function EditorHeaderActions({
  onDownloadClick,
  onLoadClick,
  onConnectClick,
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
        Conectar
        <Unplug className="text-white" />
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
