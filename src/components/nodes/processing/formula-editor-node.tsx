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
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";
import { validateFormula } from "@/utils/formula";

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
  const formulaValidation = useMemo(() => validateFormula(formula), [formula]);
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
  const draftValidation = useMemo(
    () => validateFormula(draftFormula),
    [draftFormula],
  );
  const draftVariables = draftValidation.ok ? draftValidation.variables : [];

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsDialogOpen(open);
      if (open) {
        setDraftFormula(formula);
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
          <div className="text-xl font-bold leading-none">ƒx</div>
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
              />
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
