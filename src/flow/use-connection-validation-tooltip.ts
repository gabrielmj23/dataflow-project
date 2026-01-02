import { useCallback, useEffect, useRef, useState } from "react";
import type { Connection, Edge, IsValidConnection, OnConnectStartParams, Node } from "@xyflow/react";

import { validateConnection } from "@/flow/connection-validation";

const TOOLTIP_AUTO_HIDE_MS = 350;

type TooltipState = {
  open: boolean;
  message: string;
  x: number;
  y: number;
};

function getClientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ("touches" in event) {
    const t = event.touches[0] ?? event.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

export function useConnectionValidationTooltip(nodes: Node[]) {
  const pointerRef = useRef({ x: 0, y: 0 });
  const isConnectingRef = useRef(false);
  const lastMessageRef = useRef<string | null>(null);
  const lastValidationAtRef = useRef(0);

  const [tooltip, setTooltip] = useState<TooltipState>({
    open: false,
    message: "",
    x: 0,
    y: 0,
  });

  const hide = useCallback(() => {
    lastMessageRef.current = null;
    setTooltip((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  const show = useCallback((message: string) => {
    if (!message) return;

    // Avoid re-render spam while hovering the same invalid target.
    if (lastMessageRef.current === message && tooltip.open) {
      return;
    }

    lastMessageRef.current = message;
    const { x, y } = pointerRef.current;
    setTooltip({ open: true, message, x, y });
  }, [tooltip.open]);

  const onConnectStart = useCallback(
    (event: MouseEvent | TouchEvent, _params: OnConnectStartParams) => {
      isConnectingRef.current = true;
      lastValidationAtRef.current = 0;

      const point = getClientPoint(event);
      if (point) pointerRef.current = point;

      const onMove = (e: MouseEvent | TouchEvent) => {
        const nextPoint = getClientPoint(e);
        if (nextPoint) pointerRef.current = nextPoint;

        // Keep tooltip glued to cursor while visible.
        setTooltip((prev) =>
          prev.open ? { ...prev, x: pointerRef.current.x, y: pointerRef.current.y } : prev
        );

        // XYFlow doesn't always call isValidConnection when you move away from a handle.
        // If we haven't received a validation callback recently, hide the tooltip.
        if (
          isConnectingRef.current &&
          lastValidationAtRef.current > 0 &&
          Date.now() - lastValidationAtRef.current > TOOLTIP_AUTO_HIDE_MS
        ) {
          hide();
        }
      };

      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("touchmove", onMove, { passive: true });

      // Store cleanup on ref so onConnectEnd can remove.
      (onConnectStart as unknown as { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("touchmove", onMove);
      };
    },
    []
  );

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const point = getClientPoint(event);
    if (point) pointerRef.current = point;

    isConnectingRef.current = false;
    const cleanup = (onConnectStart as unknown as { _cleanup?: () => void })._cleanup;
    cleanup?.();
    (onConnectStart as unknown as { _cleanup?: () => void })._cleanup = undefined;

    hide();
  }, [hide, onConnectStart]);

  const isValidConnection: IsValidConnection<Edge> = useCallback(
    (edgeOrConnection: Edge | Connection) => {
      if (!isConnectingRef.current) {
        return true;
      }

      const hasTarget = Boolean(edgeOrConnection.source && edgeOrConnection.target);
      if (!hasTarget) {
        hide();
        return true;
      }

      lastValidationAtRef.current = Date.now();

      const validation = validateConnection(nodes, edgeOrConnection);
      if (!validation.ok) {
        show(validation.message ?? "Conexión no válida.");
      } else {
        hide();
      }

      return true;
    },
    [hide, nodes, show]
  );

  // Cleanup if the component unmounts mid-connection.
  useEffect(() => {
    return () => {
      const cleanup = (onConnectStart as unknown as { _cleanup?: () => void })._cleanup;
      cleanup?.();
    };
  }, [onConnectStart]);

  return {
    tooltip,
    hide,
    show,
    isValidConnection,
    onConnectStart,
    onConnectEnd,
  };
}
