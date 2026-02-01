import { memo, useCallback, useId, useMemo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { List } from "lucide-react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConstantListInputNodeData = {
  label?: string;
  items?: Array<string | number>;
};

const DEFAULT_ITEMS: Array<string | number> = ["1", "2", "3"];

function parseItems(text: string): Array<string | number> {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => {
      const numeric = Number(value);
      if (/^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(numeric)) {
        return numeric;
      }
      return value;
    });
}

function itemsToMultiline(items: Array<string | number>): string {
  return items.map((item) => String(item)).join("\n");
}

export const ConstantListInputNode = memo(({ id, data }: NodeProps) => {
  const { items: rawItems } = (data ?? {}) as ConstantListInputNodeData;

  const items = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : DEFAULT_ITEMS;

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftText, setDraftText] = useState(() => itemsToMultiline(items));

  const textareaId = useId();

  const setItems = useCallback(
    (nextItems: Array<string | number>) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  items: nextItems,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const parsedDraft = useMemo(() => parseItems(draftText), [draftText]);

  const validation = useMemo(() => {
    if (parsedDraft.length === 0) {
      return { isValid: false, message: "Agrega al menos un valor." };
    }
    return { isValid: true, message: "" };
  }, [parsedDraft.length]);

  const openDialog = useCallback(() => {
    setDraftText(itemsToMultiline(items));
    setIsDialogOpen(true);
  }, [items]);

  const summary = useMemo(() => {
    const count = items.length;
    if (count === 0) return "Lista vacía";
    return count === 1 ? "1 valor" : `${count} valores`;
  }, [items.length]);

  return (
    <>
      <InputCircleNodeShell
        nodeType="constantList"
        icon={<List className="h-4 w-4" />}
        label=""
        sublabel={summary}
        sublabelClassName="text-[8px]"
        onConfigClick={openDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar lista</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escribe cada valor en una línea distinta. Se emitirá siempre la misma lista.
            </p>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={textareaId}
              >
                Valores (uno por línea)
              </label>
              <textarea
                id={textareaId}
                value={draftText}
                onChange={(e) => setDraftText(e.currentTarget.value)}
                className="w-full min-h-30 rounded-md border px-2 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Puedes mezclar números y texto; cada línea será un elemento.
              </p>
            </div>

            {!validation.isValid && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {validation.message}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraftText(itemsToMultiline(DEFAULT_ITEMS))}
              >
                Restablecer
              </Button>
              <Button
                type="button"
                disabled={!validation.isValid}
                onClick={() => {
                  if (!validation.isValid) return;
                  setItems(parsedDraft);
                  setIsDialogOpen(false);
                }}
              >
                Listo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

ConstantListInputNode.displayName = "ConstantListInputNode";
