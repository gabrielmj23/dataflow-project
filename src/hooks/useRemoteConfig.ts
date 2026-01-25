import { useCallback, useEffect, useState } from "react";

import {
  clearStoredRemoteConfig,
  getRemoteConfig,
  getRemoteConfigStorageKeys,
  setStoredRemoteConfig,
  type RemoteConfig,
} from "@/ws/remote-config";

export type UseRemoteConfigStateResult = {
  config: RemoteConfig;
  setConfig: (next: RemoteConfig) => void;
  resetConfig: () => void;
};

/**
 * Remote config state backed by localStorage.
 *
 * - Reads config via `getRemoteConfig()` (query > localStorage > env > defaults)
 * - Writes updates to localStorage
 * - Listens to `storage` events (updates across tabs)
 */
export function useRemoteConfigState(): UseRemoteConfigStateResult {
  const [config, setConfigState] = useState<RemoteConfig>(() =>
    getRemoteConfig(),
  );

  const setConfig = useCallback((next: RemoteConfig) => {
    setStoredRemoteConfig(next);
    setConfigState(next);
  }, []);

  const resetConfig = useCallback(() => {
    clearStoredRemoteConfig();
    const next = getRemoteConfig();
    setConfigState(next);
  }, []);

  useEffect(() => {
    const keys = new Set(getRemoteConfigStorageKeys());

    const onStorage = (ev: StorageEvent) => {
      if (!ev.key) return;
      if (!keys.has(ev.key)) return;
      setConfigState(getRemoteConfig());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { config, setConfig, resetConfig };
}
