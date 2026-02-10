import { useState, useCallback, useEffect } from "react";
import { Panel } from "@xyflow/react";
import { ChevronDown, ChevronUp, Trash2, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConsolePanel({
  consoleOutputText,
  activeRuntimePrompt,
  getRuntimePromptText,
  runtimePromptInput,
  setRuntimePromptInput,
  onSubmitRuntimePrompt,
  onCancelRuntimePrompt,
  onClearConsoleClick,
  consoleScrollRef,
  consoleInputRef,
  isOpen,
  onToggle,
}: {
  consoleOutputText: string;
  activeRuntimePrompt: { nodeId: string } | null;
  getRuntimePromptText: () => string;
  runtimePromptInput: string;
  setRuntimePromptInput: (value: string) => void;
  onSubmitRuntimePrompt: () => void;
  onCancelRuntimePrompt: () => void;
  onClearConsoleClick: () => void;
  consoleScrollRef: React.RefObject<HTMLDivElement | null>;
  consoleInputRef: React.RefObject<HTMLTextAreaElement | null>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [height, setHeight] = useState(120);
  const [isResizing, setIsResizing] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const startDragging = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
  }, []);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  const drag = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setOffset((prev) => ({
          x: prev.x + e.movementX,
          y: prev.y + e.movementY,
        }));
      }
    },
    [isDragging],
  );

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        setHeight((prev) => {
          const newHeight = prev - e.movementY;
          return Math.max(100, Math.min(newHeight, window.innerHeight * 0.8));
        });
      }
    },
    [isResizing],
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      document.body.style.cursor = "ns-resize";
    } else if (isDragging) {
      window.addEventListener("mousemove", drag);
      window.addEventListener("mouseup", stopDragging);
      document.body.style.cursor = "grabbing";
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      window.removeEventListener("mousemove", drag);
      window.removeEventListener("mouseup", stopDragging);
      document.body.style.cursor = "";
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      window.removeEventListener("mousemove", drag);
      window.removeEventListener("mouseup", stopDragging);
      document.body.style.cursor = "";
    };
  }, [isResizing, isDragging, resize, stopResizing, drag, stopDragging]);

  return (
    <Panel
      position="bottom-left"
      className="w-80 select-none"
      style={{
        left: "50%",
        bottom: 16,
        transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`,
        zIndex: isDragging || isResizing ? 1000 : 10,
      }}
    >
      <div className="overflow-hidden rounded-md shadow-md bg-background/90 relative">
        {isOpen && (
          <div
            className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 hover:bg-white/20 transition-colors"
            onMouseDown={startResizing}
            title="Arrastrar para cambiar altura"
          />
        )}
        <div
          className={cn(
            "flex items-center justify-between bg-(--nodi-blue) rounded-t-md px-2 pt-1 text-sm font-medium text-white cursor-grab active:cursor-grabbing",
            !isOpen && "pb-1",
          )}
          onMouseDown={startDragging}
        >
          <div className="flex items-center gap-1 pointer-events-none">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hover:bg-white/10 pointer-events-auto"
              onClick={onToggle}
              title={isOpen ? "Minimizar consola" : "Expandir consola"}
              aria-label={isOpen ? "Minimizar consola" : "Expandir consola"}
            >
              {isOpen ? (
                <ChevronDown className="text-white" />
              ) : (
                <ChevronUp className="text-white" />
              )}
            </Button>
            <span className="select-none">Consola</span>
            {isOpen && (
              <GripHorizontal className="w-3 h-3 text-white/30 ml-1" />
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="hover:bg-white/10"
            onClick={onClearConsoleClick}
            title="Limpiar consola"
            aria-label="Limpiar consola"
          >
            <Trash2 className="text-white" />
          </Button>
        </div>

        {isOpen && (
          <div className="p-1 select-text bg-(--nodi-blue)">
            <div className="overflow-hidden rounded-sm bg-neutral-50">
              <div
                ref={consoleScrollRef}
                className="overflow-auto p-2 text-xs font-mono text-foreground whitespace-pre-wrap"
                style={{ height: `${height}px` }}
              >
                {consoleOutputText}

                {activeRuntimePrompt != null && (
                  <>
                    {consoleOutputText ? "\n" : ""}
                    {getRuntimePromptText()}
                    {"\n"}
                    <div className="flex items-start gap-2">
                      <div className="pt-0.5 text-xs font-mono text-muted-foreground">
                        &gt;
                      </div>
                      <textarea
                        ref={consoleInputRef}
                        rows={1}
                        value={runtimePromptInput}
                        onChange={(e) =>
                          setRuntimePromptInput(e.currentTarget.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onSubmitRuntimePrompt();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            onCancelRuntimePrompt();
                          }
                        }}
                        placeholder=""
                        className="w-full resize-none bg-transparent text-xs font-mono text-foreground outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
