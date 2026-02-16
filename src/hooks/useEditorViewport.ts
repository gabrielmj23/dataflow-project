import { useEffect, useRef, useState } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { ChallengeDefinition } from "@/challenges/definitions";

const CHALLENGE_VIEWPORT_SHIFT = { x: 100, y: 60 } as const;

interface UseEditorViewportParams {
  challengeDefinition: ChallengeDefinition | null;
  reactFlowInstance: ReactFlowInstance | null;
}

export function useEditorViewport({
  challengeDefinition,
  reactFlowInstance,
}: UseEditorViewportParams) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const [editorSize, setEditorSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const appliedViewportRef = useRef<boolean>(false);

  const [sidebarTop, setSidebarTop] = useState<number | null>(64);

  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el) {
      setTimeout(() => {
        setEditorSize(null);
      }, 0);
      return;
    }
    const ro = new ResizeObserver(() => {
      setEditorSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setEditorSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    appliedViewportRef.current = false;
  }, [challengeDefinition?.id]);

  useEffect(() => {
    if (!challengeDefinition) return;
    if (!reactFlowInstance) return;
    if (!editorSize) return;
    if (appliedViewportRef.current) return;

    const allNodes = reactFlowInstance.getNodes();
    if (!allNodes || allNodes.length === 0) return;

    const targetNodes = allNodes.filter((n) => n.data?.locked === true);
    const nodesToUse = targetNodes.length > 0 ? targetNodes : allNodes;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodesToUse) {
      const px = Number(n.position?.x ?? 0);
      const py = Number(n.position?.y ?? 0);
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }

    if (!isFinite(minX) || !isFinite(minY)) return;

    const padding = 120;
    const bboxWidth = Math.max(10, maxX - minX);
    const bboxHeight = Math.max(10, maxY - minY);

    const zoomX = editorSize.width / (bboxWidth + padding * 2);
    const zoomY = editorSize.height / (bboxHeight + padding * 2);
    let targetZoom = Math.min(zoomX, zoomY);
    targetZoom = Math.max(0.2, Math.min(1.5, targetZoom));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const viewportX =
      editorSize.width / 2 - centerX * targetZoom - CHALLENGE_VIEWPORT_SHIFT.x;
    const viewportY =
      editorSize.height / 2 - centerY * targetZoom - CHALLENGE_VIEWPORT_SHIFT.y;

    try {
      reactFlowInstance.setViewport(
        { x: viewportX, y: viewportY, zoom: targetZoom },
        { duration: 0 },
      );
      appliedViewportRef.current = true;
    } catch {
      // ignore
    }
  }, [challengeDefinition, reactFlowInstance, editorSize]);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(
        "[data-app-header]",
      ) as HTMLElement | null;
      if (el) setSidebarTop(Math.ceil(el.getBoundingClientRect().height));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    const el = document.querySelector(
      "[data-app-header]",
    ) as HTMLElement | null;
    if (el) ro.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, []);

  return { editorContainerRef, sidebarTop };
}
