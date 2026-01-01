import { memo, useEffect, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { PenSquare } from "lucide-react";

import { IoRectNodeShell } from "@/components/nodes/io/io-rect-node-shell";

export type WriteNodeData = {
  label?: string;
  /** Number of input handles to render. We keep one extra empty input. */
  inputCount?: number;
  runtimeError?: string | null;
};

function sanitizeInputCount(value: unknown): number {
  const n = typeof value === "number" ? value : 1;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

export const WriteNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Escribir",
    runtimeError,
    inputCount: rawInputCount,
  } = (data ?? {}) as WriteNodeData;

  const inputCount = useMemo(
    () => sanitizeInputCount(rawInputCount),
    [rawInputCount]
  );

  const targetHandleIds = useMemo(
    () => Array.from({ length: inputCount }, (_, i) => `in-${i + 1}`),
    [inputCount]
  );

  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputCount, updateNodeInternals]);

  return (
    <IoRectNodeShell
      icon={<PenSquare className="h-6 w-6" />}
      label={label}
      variant="sink"
      targetHandleIds={targetHandleIds}
      runtimeError={runtimeError}
    />
  );
});

WriteNode.displayName = "WriteNode";
