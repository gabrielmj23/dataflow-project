import type { FlowNode } from "@/utils/flow";

export function repositionPairedSelectors(nodes: FlowNode[], setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>) {
  // Find all conditionals with pairId and move paired selector to centered position
  setNodes((prev) => {
    const updated = prev.map((node) => ({ ...node }));

    for (const cond of nodes) {
      if (cond.type !== "conditional") continue;
      const pairId = (cond.data as { pairId?: string | null })?.pairId ?? null;
      if (!pairId) continue;

      const self = nodes.find((n) => n.id === cond.id);
      if (!self) continue;

      const targetY = (self.position?.y ?? 0) + (self.measured?.height ?? 110) + Math.max(20, ((cond.data as any)?.pairOffsetY ?? 160) - 110);
      const centerOffsetX = 32; // assume conditional w-72 (288px) and selector w-56 (224px)
      const targetX = (self.position?.x ?? 0) + centerOffsetX;

      for (let i = 0; i < updated.length; i++) {
        const n = updated[i];
        if (n.type !== "selector") continue;
        if ((n.data as { pairId?: string | null })?.pairId !== pairId) continue;

        if (n.selected === true || (n as any).dragging === true) continue;

        const curX = n.position?.x ?? 0;
        const curY = n.position?.y ?? 0;
        if (Math.abs(curX - targetX) < 1 && Math.abs(curY - targetY) < 1) continue;

        updated[i] = {
          ...n,
          position: {
            x: targetX,
            y: targetY,
          },
        };
      }
    }

    return updated;
  });
}
