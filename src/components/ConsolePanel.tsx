import { Panel } from "@xyflow/react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return (
    <Panel
      position="bottom-left"
      className="w-80"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 16,
      }}
    >
      <div className="overflow-hidden rounded-md border bg-background/90 shadow-md backdrop-blur-sm">
        <div className="flex items-center justify-between border-b px-2 py-1 text-sm font-medium">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onToggle}
              title={isOpen ? "Minimizar consola" : "Expandir consola"}
              aria-label={isOpen ? "Minimizar consola" : "Expandir consola"}
            >
              {isOpen ? <ChevronDown /> : <ChevronUp />}
            </Button>
            <span className="select-none">Consola</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClearConsoleClick}
            title="Limpiar consola"
            aria-label="Limpiar consola"
          >
            <Trash2 />
          </Button>
        </div>

        {isOpen && (
          <div className="p-2">
            <div className="overflow-hidden rounded-md border bg-background/60">
              <div
                ref={consoleScrollRef}
                className="h-48 overflow-auto p-2 text-xs font-mono text-foreground whitespace-pre-wrap"
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
