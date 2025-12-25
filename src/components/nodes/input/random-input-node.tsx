import { memo, useCallback, useId, useMemo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Minus, Plus, Shuffle } from "lucide-react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type RandomInputNodeData = {
  label?: string;
  min?: number;
  max?: number;
};

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

export const RandomInputNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Valor Aleatorio",
    min: rawMin,
    max: rawMax,
  } = (data ?? {}) as RandomInputNodeData;

  const min = Number.isFinite(rawMin) ? (rawMin as number) : DEFAULT_MIN;
  const max = Number.isFinite(rawMax) ? (rawMax as number) : DEFAULT_MAX;

  const { setNodes } = useReactFlow();
  const setRange = useCallback(
    (nextMin: number, nextMax: number) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  min: nextMin,
                  max: nextMax,
                },
              }
            : node
        )
      );
    },
    [id, setNodes]
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [draftMin, setDraftMin] = useState<number>(min);
  const [draftMax, setDraftMax] = useState<number>(max);

  const minInputId = useId();
  const maxInputId = useId();

  const validation = useMemo(() => {
    if (!Number.isFinite(draftMin) || !Number.isFinite(draftMax)) {
      return { isValid: false, message: "Ingresa números válidos." };
    }
    if (draftMin > draftMax) {
      return {
        isValid: false,
        message: "El mínimo no puede ser mayor que el máximo.",
      };
    }
    return { isValid: true, message: "" };
  }, [draftMin, draftMax]);

  const openDialog = useCallback(() => {
    setDraftMin(min);
    setDraftMax(max);
    setIsDialogOpen(true);
  }, [max, min]);

  return (
    <>
      <InputCircleNodeShell
        icon={
          <div className="flex flex-col items-center leading-none">
            <Shuffle className="size-6" />
            <span className="mt-1 text-[10px] font-semibold">
              {min} – {max}
            </span>
          </div>
        }
        label={label}
        onConfigClick={openDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar rango aleatorio</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elige el rango del que saldrá el número aleatorio.
            </p>

            {/* Mínimo */}
            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={minInputId}
              >
                Mínimo
              </label>
              <div className="flex">
                <Button
                  type="button"
                  className="rounded-r-none"
                  onClick={() => setDraftMin((v) => v - 1)}
                >
                  <Minus />
                </Button>
                <Input
                  id={minInputId}
                  type="number"
                  value={draftMin}
                  onChange={(e) => {
                    const v = e.currentTarget.valueAsNumber;
                    setDraftMin(Number.isFinite(v) ? v : DEFAULT_MIN);
                  }}
                  className="rounded-none"
                  step={1}
                />
                <Button
                  type="button"
                  className="rounded-l-none"
                  onClick={() => setDraftMin((v) => v + 1)}
                >
                  <Plus />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                El número más pequeño posible.
              </p>
            </div>

            {/* Máximo */}
            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={maxInputId}
              >
                Máximo
              </label>
              <div className="flex">
                <Button
                  type="button"
                  className="rounded-r-none"
                  onClick={() => setDraftMax((v) => v - 1)}
                >
                  <Minus />
                </Button>
                <Input
                  id={maxInputId}
                  type="number"
                  value={draftMax}
                  onChange={(e) => {
                    const v = e.currentTarget.valueAsNumber;
                    setDraftMax(Number.isFinite(v) ? v : DEFAULT_MAX);
                  }}
                  className="rounded-none"
                  step={1}
                />
                <Button
                  type="button"
                  className="rounded-l-none"
                  onClick={() => setDraftMax((v) => v + 1)}
                >
                  <Plus />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                El número más grande posible.
              </p>
            </div>

            {/* Validación */}
            {!validation.isValid && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {validation.message}
              </div>
            )}

            {/* Acción simple e intuitiva */}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraftMin(DEFAULT_MIN);
                  setDraftMax(DEFAULT_MAX);
                }}
              >
                Restablecer
              </Button>
              <Button
                type="button"
                disabled={!validation.isValid}
                onClick={() => {
                  if (!validation.isValid) {
                    return;
                  }
                  setRange(draftMin, draftMax);
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

RandomInputNode.displayName = "RandomInputNode";
