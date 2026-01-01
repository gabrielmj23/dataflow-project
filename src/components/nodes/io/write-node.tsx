import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { PenSquare } from "lucide-react";

import { IoRectNodeShell } from "@/components/nodes/io/io-rect-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type WriteNodeData = {
  label?: string;
  /** Number of input handles to render. We keep one extra empty input. */
  inputCount?: number;
  /** Text template to print. Use placeholders like {1}, {2}, ... */
  template?: string;
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
    template: rawTemplate,
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

  const { setNodes } = useReactFlow();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState<string>(
    typeof rawTemplate === "string" ? rawTemplate : "{1}"
  );

  const openDialog = useCallback(() => {
    setDraftTemplate(typeof rawTemplate === "string" ? rawTemplate : "{1}");
    setIsDialogOpen(true);
  }, [rawTemplate]);

  const saveTemplate = useCallback(() => {
    const nextTemplate = draftTemplate;
    setNodes((prev) =>
      prev.map((n) =>
        String(n.id) === String(id)
          ? {
              ...n,
              data: {
                ...(n.data && typeof n.data === "object"
                  ? (n.data as Record<string, unknown>)
                  : {}),
                template: nextTemplate,
              },
            }
          : n
      )
    );
    setIsDialogOpen(false);
  }, [draftTemplate, id, setNodes]);

  return (
    <>
      <IoRectNodeShell
        icon={<PenSquare className="h-6 w-6" />}
        label={label}
        variant="sink"
        targetHandleIds={targetHandleIds}
        onConfigClick={openDialog}
        runtimeError={runtimeError}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Configurar Escribir</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escribe un texto y usa variables para referenciar entradas:
              <span className="font-mono"> {"{1}"}</span>,
              <span className="font-mono"> {"{2}"}</span>, etc.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Texto a escribir
              </label>
              <Input
                value={draftTemplate}
                placeholder="Ej: Resultado: {1} + {2} = {3}"
                onChange={(e) => setDraftTemplate(e.currentTarget.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={saveTemplate}>
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

WriteNode.displayName = "WriteNode";
