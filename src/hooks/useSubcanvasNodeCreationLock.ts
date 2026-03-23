import { useEffect } from "react";

const SUBCANVAS_OPEN_COUNT_ATTR = "data-subcanvas-open-count";

function getOpenCount(host: HTMLElement): number {
  const raw = host.getAttribute(SUBCANVAS_OPEN_COUNT_ATTR);
  const parsed = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getLockHost(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  return document.body;
}

export function isMainCanvasNodeCreationLocked(): boolean {
  const host = getLockHost();
  if (!host) {
    return false;
  }

  return getOpenCount(host) > 0;
}

export function useSubcanvasNodeCreationLock(isSubcanvasOpen: boolean): void {
  useEffect(() => {
    if (!isSubcanvasOpen) {
      return;
    }

    const host = getLockHost();
    if (!host) {
      return;
    }

    host.setAttribute(
      SUBCANVAS_OPEN_COUNT_ATTR,
      String(getOpenCount(host) + 1),
    );

    return () => {
      const currentCount = getOpenCount(host);
      if (currentCount <= 1) {
        host.removeAttribute(SUBCANVAS_OPEN_COUNT_ATTR);
        return;
      }

      host.setAttribute(SUBCANVAS_OPEN_COUNT_ATTR, String(currentCount - 1));
    };
  }, [isSubcanvasOpen]);
}
