import { useMemo } from "react";

import { useWsControllerClient } from "@/hooks/useWsControllerClient";
import type { RemoteConfig } from "@/ws/remote-config";
import { Panel } from "@xyflow/react";

export function RemoteControllerPanel({
  remoteConfig,
}: {
  remoteConfig: RemoteConfig;
}) {
  const { enabled, state, lastError } = useWsControllerClient(remoteConfig);

  const subtitle = useMemo(() => {
    if (!enabled) return "Modo remoto deshabilitado";
    if (!state.connected) return "Conectando…";
    if (!state.runnerConnected) return "Conectado al server, runner offline";
    return "Conectado";
  }, [enabled, state.connected, state.runnerConnected]);

  if (!enabled) return null;

  return (
    <Panel
      position="top-right"
      className="w-90 overflow-hidden rounded-md border bg-background/90 shadow-md backdrop-blur-sm mt-20!"
      role="region"
      aria-label="Remote controller"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <div className="text-sm font-medium">Consola remota</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
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
    </Panel>
  );
}
