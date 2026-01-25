import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useWsControllerClient } from "@/hooks/useWsControllerClient";

export function RemoteControllerPanel() {
  const { enabled, state, lastError, run, stop, requestSnapshot } =
    useWsControllerClient();

  const subtitle = useMemo(() => {
    if (!enabled) return "Modo remoto deshabilitado";
    if (!state.connected) return "Conectando…";
    if (!state.runnerConnected) return "Conectado al server, runner offline";
    return "Conectado";
  }, [enabled, state.connected, state.runnerConnected]);

  if (!enabled) return null;

  return (
    <div
      className="fixed top-4 left-4 z-50 w-90 overflow-hidden rounded-md border bg-background/90 shadow-md backdrop-blur-sm"
      role="region"
      aria-label="Remote controller"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <div className="text-sm font-medium">Controller remoto</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={requestSnapshot}
          >
            Snapshot
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={run}
            disabled={!state.runnerConnected || state.isEngineRunning}
          >
            Run
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={stop}
            disabled={!state.runnerConnected}
          >
            Stop
          </Button>
        </div>
      </div>

      <div className="p-3">
        {lastError ? (
          <div className="mb-2 text-xs text-red-600">{lastError}</div>
        ) : null}

        <div className="overflow-hidden rounded-md border bg-background/60">
          <div className="h-48 overflow-auto p-2 text-xs font-mono whitespace-pre-wrap">
            {state.consoleText || "(sin logs)"}
          </div>
        </div>
      </div>
    </div>
  );
}
