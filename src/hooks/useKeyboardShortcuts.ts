import { useEffect } from "react";
import type { Edge } from "@xyflow/react";
import type { FlowEdge, FlowNode } from "@/utils/flow";

interface UseKeyboardShortcutsParams {
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  pasteSelection: () => void;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
}

/**
 * Registers global keyboard shortcuts for the editor canvas:
 * - Ctrl/Cmd + Z → undo  
 * - Ctrl/Cmd + Shift + Z / Ctrl + Y → redo
 * - Ctrl/Cmd + C → copy selection
 * - Ctrl/Cmd + V → paste selection
 * - Delete / Backspace → remove selected (non-locked) nodes & edges
 */
export function useKeyboardShortcuts({
  undo,
  redo,
  copySelection,
  pasteSelection,
  setNodes,
  setEdges,
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const key = e.key.toLowerCase();
      const hasCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isTextInput) return;

      if (hasCtrlOrMeta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (hasCtrlOrMeta && key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (hasCtrlOrMeta && key === "c") {
        e.preventDefault();
        copySelection();
        return;
      }

      if (hasCtrlOrMeta && key === "v") {
        e.preventDefault();
        pasteSelection();
        return;
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return;

      setNodes((prevNodes) => {
        const lockedNodeIds = new Set(
          prevNodes
            .filter((node) => {
              const data =
                node.data && typeof node.data === "object"
                  ? (node.data as Record<string, unknown>)
                  : null;
              return data?.locked === true || node.deletable === false;
            })
            .map((node) => String(node.id)),
        );

        const removable = prevNodes.filter(
          (node) => node.selected && !lockedNodeIds.has(String(node.id)),
        );

        const removedIds = new Set(removable.map((n) => n.id));

        const nextNodes = prevNodes.filter(
          (node) => !removedIds.has(String(node.id)),
        );

        setEdges((prevEdges) =>
          prevEdges.filter((edge) => {
            const data =
              edge.data && typeof edge.data === "object"
                ? (edge.data as Record<string, unknown>)
                : null;
            const locked = data?.locked === true;
            const notDeletable = edge.deletable === false;

            const src = String((edge as Edge).source);
            const tgt = String((edge as Edge).target);
            if (removedIds.has(src) || removedIds.has(tgt)) return false;

            if ((edge as Edge).selected) {
              if (locked || notDeletable) return true;
              return false;
            }

            return true;
          }),
        );

        return nextNodes;
      });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [copySelection, pasteSelection, redo, undo, setNodes, setEdges]);
}
