import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Position,
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";
import {
  FORMULA_FUNCTION_GUIDE,
  FORMULA_OPERATOR_GUIDE,
  validateFormula,
} from "@/utils/formula";

export type FormulaEditorNodeData = {
  label?: string;
  formula?: string;
  variables?: string[];
  runtimeError?: string | null;
};

const DEFAULT_FORMULA = "";
function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return ["50%"];

  const start = 20;
  const end = 80;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export const FormulaEditorNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Editor de fórmulas",
    formula: rawFormula,
    runtimeError,
  } = (data ?? {}) as FormulaEditorNodeData;

  const formula = typeof rawFormula === "string" ? rawFormula : DEFAULT_FORMULA;
  const formulaValidation = useMemo(
    () => validateFormula(formula, { mode: "arithmetic" }),
    [formula],
  );
  const variables = useMemo(
    () => (formulaValidation.ok ? formulaValidation.variables : []),
    [formulaValidation],
  );
  const handleIds = useMemo(
    () => variables.map((_, index) => `in-${index + 1}`),
    [variables],
  );
  const handleOffsets = useMemo(() => offsets(handleIds.length), [handleIds]);

  const inputId = useId();
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    // Notify react-flow that handles changed so it recomputes internals
    try {
      updateNodeInternals(id);
    } catch {
      // ignore if not mounted yet
    }
  }, [id, handleIds.length, updateNodeInternals]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftFormula, setDraftFormula] = useState(formula);
  const [showFunctions, setShowFunctions] = useState(false);
  const [showOperators, setShowOperators] = useState(false);
  const draftValidation = useMemo(
    () => validateFormula(draftFormula, { mode: "arithmetic" }),
    [draftFormula],
  );
  const draftVariables = draftValidation.ok ? draftValidation.variables : [];

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsDialogOpen(open);
      if (open) {
        setDraftFormula(formula);
        setShowFunctions(false);
        setShowOperators(false);
      }
    },
    [formula],
  );

  const applyFormula = useCallback(() => {
    if (!draftValidation.ok) {
      return;
    }
    const nextFormulaRaw = draftFormula.trim();
    const nextFormula = nextFormulaRaw === "" ? undefined : nextFormulaRaw;
    const nextVariables = draftValidation.variables;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                ...(nextFormula !== undefined
                  ? { formula: nextFormula }
                  : { formula: undefined }),
                ...(nextVariables.length > 0
                  ? { variables: nextVariables }
                  : { variables: undefined }),
              },
            }
          : node,
      ),
    );

    setIsDialogOpen(false);
  }, [draftFormula, draftValidation, id, setNodes]);

  const outMask = getPortTypeMask({
    nodeType: "formulaEditor",
    handleType: "source",
    handleId: "out",
  });
  const outType = maskToVisualPortDataType(outMask);

  return (
    <>
      <BaseNode
        runtimeError={runtimeError}
        onConfigClick={() => handleDialogOpenChange(true)}
        className="relative flex h-20 w-56 flex-col items-center justify-center rounded-2xl border-sky-700 bg-sky-500 px-5 text-center text-white shadow-md"
      >
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-2xl font-bold leading-none">ƒx</div>
          {formula ? (
            <div className="max-w-40 truncate text-md leading-tight">
              {formula}
            </div>
          ) : (
            <div className="text-sm leading-tight">{label}</div>
          )}
        </div>

        {handleIds.map((handleId, index) => {
          const mask = getPortTypeMask({
            nodeType: "formulaEditor",
            handleType: "target",
            handleId,
          });
          const dt = maskToVisualPortDataType(mask);
          return (
            <CustomTypedHandle
              key={handleId}
              type="target"
              position={Position.Left}
              id={handleId}
              style={{ top: handleOffsets[index] ?? "50%" }}
              dataType={dt}
              typeMask={mask}
              className="absolute -left-1 h-2 w-2 -translate-y-1/2"
              indicatorClassName="border-sky-700"
            />
          );
        })}

        {handleIds.map((handleId, index) => (
          <span
            key={`label-${handleId}`}
            className="pointer-events-none absolute left-3 -translate-y-1/2 text-[0.7rem] font-semibold text-white/90"
            style={{ top: handleOffsets[index] ?? "50%" }}
          >
            {variables[index] ?? ""}
          </span>
        ))}

        <CustomTypedHandle
          type="source"
          position={Position.Right}
          id="out"
          dataType={outType}
          typeMask={outMask}
          className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
          indicatorClassName="border-sky-700"
        />
      </BaseNode>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar fórmula</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFormula();
            }}
            className="space-y-3"
          >
            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={inputId}
              >
                Fórmula:
              </label>
              <Input
                id={inputId}
                name="formula"
                value={draftFormula}
                onChange={(e) => setDraftFormula(e.currentTarget.value)}
                placeholder="Ej: a*b+c"
                aria-invalid={!draftValidation.ok}
                autoComplete="off"
              />
              <div className="mt-2 flex justify-start gap-2">
                <Popover open={showFunctions} onOpenChange={setShowFunctions}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      aria-expanded={showFunctions}
                      aria-controls={`${inputId}-functions-guide`}
                    >
                      {showFunctions ? "Ocultar funciones" : "Ver funciones"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    id={`${inputId}-functions-guide`}
                    align="start"
                    side="bottom"
                    className="w-96 max-h-72 overflow-y-auto p-3"
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onWheelCapture={(e) => e.stopPropagation()}
                    onTouchMoveCapture={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2 text-sm font-semibold">
                      Funciones permitidas
                    </div>
                    <ul className="space-y-1.5 text-xs text-foreground">
                      {FORMULA_FUNCTION_GUIDE.map((fn) => (
                        <li key={fn.name} className="leading-snug">
                          <span className="font-medium">{fn.labelEs}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            {"->"}{" "}
                          </span>
                          <span className="font-mono">{fn.signature}</span>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>

                <Popover open={showOperators} onOpenChange={setShowOperators}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      aria-expanded={showOperators}
                      aria-controls={`${inputId}-operators-guide`}
                    >
                      {showOperators ? "Ocultar operadores" : "Ver operadores"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    id={`${inputId}-operators-guide`}
                    align="start"
                    side="bottom"
                    className="w-72 max-h-72 overflow-y-auto p-3"
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onWheelCapture={(e) => e.stopPropagation()}
                    onTouchMoveCapture={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2 text-sm font-semibold">Operadores</div>
                    <ul className="space-y-1.5 text-xs text-foreground">
                      {FORMULA_OPERATOR_GUIDE.map((op) => (
                        <li key={op.symbol} className="leading-snug">
                          <span className="font-medium">{op.labelEs}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            {"->"}{" "}
                          </span>
                          <span className="font-mono">{op.symbol}</span>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {!draftValidation.ok && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                {draftValidation.error ?? "Fórmula inválida"}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Variables detectadas: {draftVariables.join(", ") || "—"}
              </span>
              <Button type="submit" disabled={!draftValidation.ok}>
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
});

FormulaEditorNode.displayName = "FormulaEditorNode";
