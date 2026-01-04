import { createContext, useContext } from "react";

import type { PortDataTypeMask } from "@/flow/port-data-type";

export type ConnectionHighlightState =
  | {
      sourceMask: PortDataTypeMask;
    }
  | null;

const ConnectionHighlightContext = createContext<ConnectionHighlightState>(null);

export const ConnectionHighlightProvider = ConnectionHighlightContext.Provider;

export function useConnectionHighlight(): ConnectionHighlightState {
  return useContext(ConnectionHighlightContext);
}
