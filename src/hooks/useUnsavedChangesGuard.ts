import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

type UseUnsavedChangesGuardParams = {
  enabled: boolean;
  currentSignature: string;
  initialSavedSignature: string;
  warningMessage?: string;
};

export function buildUnsavedChangesSignature(payload: unknown): string {
  return JSON.stringify(payload);
}

export function useUnsavedChangesGuard({
  enabled,
  currentSignature,
  initialSavedSignature,
  warningMessage = "Tienes cambios sin guardar. Si sales de esta vista, se perderan.",
}: UseUnsavedChangesGuardParams) {
  const location = useLocation();
  const [lastSavedSignature, setLastSavedSignature] = useState<string>(
    initialSavedSignature,
  );
  const popstateGuardRef = useRef(false);

  const hasUnsavedChanges = useMemo(
    () => enabled && currentSignature !== lastSavedSignature,
    [enabled, currentSignature, lastSavedSignature],
  );

  const markAsSaved = useCallback(
    (signature?: string) => {
      setLastSavedSignature(signature ?? currentSignature);
    },
    [currentSignature],
  );

  const confirmLeaveIfNeeded = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(warningMessage);
  }, [hasUnsavedChanges, warningMessage]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target =
        event.target instanceof Element
          ? (event.target.closest("a[href]") as HTMLAnchorElement | null)
          : null;

      if (!target) {
        return;
      }

      if (target.target && target.target !== "_self") {
        return;
      }

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const targetUrl = new URL(target.href, window.location.href);
      const currentUrl = `${location.pathname}${location.search}${location.hash}`;
      const nextUrl = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

      if (
        targetUrl.origin !== window.location.origin ||
        currentUrl === nextUrl
      ) {
        return;
      }

      const shouldLeave = window.confirm(warningMessage);
      if (!shouldLeave) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onPopState = () => {
      if (popstateGuardRef.current) {
        popstateGuardRef.current = false;
        return;
      }

      const shouldLeave = window.confirm(warningMessage);
      if (!shouldLeave) {
        popstateGuardRef.current = true;
        window.history.go(1);
      }
    };

    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [
    hasUnsavedChanges,
    location.hash,
    location.pathname,
    location.search,
    warningMessage,
  ]);

  return {
    hasUnsavedChanges,
    markAsSaved,
    confirmLeaveIfNeeded,
  };
}
