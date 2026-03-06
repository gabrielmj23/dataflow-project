import { memo, useCallback, useId, useMemo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Dices } from "lucide-react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ChoiceInputNodeData = {
  label?: string;
  choices?: string[];
};

const DEFAULT_CHOICES = ["opción 1", "opción 2", "opción 3"];

export const ChoiceInputNode = memo(({ id, data }: NodeProps) => {
  const { choices: rawChoices } = (data ??
    {}) as ChoiceInputNodeData;

  const choices =
    Array.isArray(rawChoices) && rawChoices.length > 0
      ? rawChoices
      : DEFAULT_CHOICES;

  const { setNodes } = useReactFlow();
  const setChoices = useCallback(
    (nextChoices: string[]) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  choices: nextChoices,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftText, setDraftText] = useState(() => choices.join("\n"));

  const textareaId = useId();

  const validation = useMemo(() => {
    const parsed = draftText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length === 0)
      return { isValid: false, message: "Agrega al menos una opción." };
    return { isValid: true, message: "" };
  }, [draftText]);

  const openDialog = useCallback(() => {
    setDraftText(choices.join("\n"));
    setIsDialogOpen(true);
  }, [choices]);

  return (
    <>
      <InputCircleNodeShell
        nodeType="choiceInput"
        icon={<Dices className="h-5 w-5" />}
        label=""
        sublabel={`${choices.length} opciones`}
        sublabelClassName="text-[8px]"
        onConfigClick={openDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar opciones</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escribe las opciones una por línea o separadas por comas. Se
              seleccionará una al azar entre estas.
            </p>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={textareaId}
              >
                Opciones
              </label>
              <textarea
                id={textareaId}
                value={draftText}
                onChange={(e) => setDraftText(e.currentTarget.value)}
                className="w-full min-h-30 rounded-md border px-2 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Una por línea o separadas por comas.
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
                onClick={() => {
                  setDraftText(DEFAULT_CHOICES.join("\n"));
                }}
              >
                Restablecer
              </Button>
              <Button
                type="button"
                disabled={!validation.isValid}
                onClick={() => {
                  if (!validation.isValid) return;
                  const parsed = draftText
                    .split(/[,\n]/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setChoices(parsed);
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

ChoiceInputNode.displayName = "ChoiceInputNode";
