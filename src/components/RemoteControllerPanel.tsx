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
    return "Conectado";
  }, [enabled, state.connected]);

  if (!enabled) return null;

  return (
    <Panel
      position="top-right"
      className="w-90 overflow-hidden rounded-md border bg-(--nodi-blue) shadow-md backdrop-blur-sm mt-20!"
      role="region"
      aria-label="Remote controller"
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <div>
          <div className="text-sm font-medium text-white">Consola remota</div>
          <div className="text-xs text-neutral-100">{subtitle}</div>
        </div>
      </div>

      <div className="p-1.5">
        {lastError ? (
          <div className="mb-2 text-xs text-red-600">{lastError}</div>
        ) : null}

        <div className="overflow-hidden rounded-md border bg-neutral-50">
          <div className="h-48 overflow-auto p-2 text-xs font-mono whitespace-pre-wrap">
            {state.consoleText || "(sin logs)"}
          </div>
        </div>
      </div>
    </Panel>
  );
}
