import { Controls, ControlButton } from "@xyflow/react";
import {
  Hand,
  MousePointer2,
  BrushCleaning,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toggleSoundEnabled } from "@/lib/sound";

interface EditorCanvasControlsProps {
  canvasMode: "pan" | "select";
  onSetCanvasMode: (mode: "pan" | "select") => void;
  soundsEnabled: boolean;
  onSoundsEnabledChange: (enabled: boolean) => void;
  onLayout: () => void;
}

export function EditorCanvasControls({
  canvasMode,
  onSetCanvasMode,
  soundsEnabled,
  onSoundsEnabledChange,
  onLayout,
}: EditorCanvasControlsProps) {
  return (
    <Controls>
      <ControlButton
        onClick={() => onSetCanvasMode("pan")}
        aria-pressed={canvasMode === "pan"}
        title="Modo arrastrar (mover canvas)"
        className="rf-mode-toggle"
      >
        <Hand className="rf-icon-hand" />
      </ControlButton>
      <ControlButton
        title={soundsEnabled ? "Silenciar sonidos" : "Activar sonidos"}
        onClick={() => {
          const next = toggleSoundEnabled();
          onSoundsEnabledChange(next);
        }}
        aria-pressed={soundsEnabled}
      >
        {soundsEnabled ? <Volume2 /> : <VolumeX />}
      </ControlButton>
      <ControlButton
        onClick={() => onSetCanvasMode("select")}
        aria-pressed={canvasMode === "select"}
        title="Modo selección (cuadro)"
        className="rf-mode-toggle"
      >
        <MousePointer2 />
      </ControlButton>
      <ControlButton title="Mejorar formato" onClick={onLayout}>
        <BrushCleaning className="fill-none!" />
      </ControlButton>
    </Controls>
  );
}
