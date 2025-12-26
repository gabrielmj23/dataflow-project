import { memo, useCallback, useId, useMemo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

export type SequenceNodeData = {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
};

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_STEP = 1;

export const SequenceNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Generar Secuencia",
    min: rawMin,
    max: rawMax,
    step: rawStep,
  } = (data ?? {}) as SequenceNodeData;

  const min = Number.isFinite(rawMin) ? (rawMin as number) : DEFAULT_MIN;
  const max = Number.isFinite(rawMax) ? (rawMax as number) : DEFAULT_MAX;
  const step =
    Number.isFinite(rawStep) && rawStep! > 0
      ? (rawStep as number)
      : DEFAULT_STEP;

  const { setNodes } = useReactFlow();
  const setRange = useCallback(
    (nextMin: number, nextMax: number, nextStep: number) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  min: nextMin,
                  max: nextMax,
                  step: nextStep,
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
  const [draftStep, setDraftStep] = useState<number>(step);

  const minInputId = useId();
  const maxInputId = useId();
  const stepInputId = useId();

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
      <IterationRectNodeShell
        icon={<span className="text-sm font-bold">1..N</span>}
        label={label}
        variant="doubleInSingleOut"
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

            {/* Paso */}
            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={stepInputId}
              >
                Paso
              </label>
              <div className="flex">
                <Button
                  type="button"
                  className="rounded-r-none"
                  onClick={() => setDraftStep((v) => Math.max(v - 1, 1))}
                >
                  <Minus />
                </Button>
                <Input
                  id={stepInputId}
                  type="number"
                  value={draftStep}
                  onChange={(e) => {
                    const v = e.currentTarget.valueAsNumber;
                    setDraftStep(Number.isFinite(v) ? v : DEFAULT_STEP);
                  }}
                  className="rounded-none"
                  step={1}
                />
                <Button
                  type="button"
                  className="rounded-l-none"
                  onClick={() => setDraftStep((v) => v + 1)}
                >
                  <Plus />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                El tamaño del paso.
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
                  setDraftStep(DEFAULT_STEP);
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
                  setRange(draftMin, draftMax, draftStep);
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

SequenceNode.displayName = "SequenceNode";
