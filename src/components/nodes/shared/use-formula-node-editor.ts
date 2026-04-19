import { useCallback, useEffect, useMemo, useState } from "react";
import type { Node } from "@xyflow/react";

import {
  getFormulaFunctionGuide,
  getFormulaOperatorGuide,
  type FormulaValidationMode,
  validateFormula,
} from "@/utils/formula";

type SetNodesFn = (payload: Node[] | ((nodes: Node[]) => Node[])) => void;

type UseFormulaNodeEditorParams = {
  nodeId: string;
  formula: string;
  mode: FormulaValidationMode;
  setNodes: SetNodesFn;
  updateNodeInternals: (id: string) => void;
};

function getFormulaHandleOffsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return ["50%"];

  const start = 20;
  const end = 80;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export function useFormulaNodeEditor(params: UseFormulaNodeEditorParams) {
  const { nodeId, formula, mode, setNodes, updateNodeInternals } = params;

  const formulaValidation = useMemo(
    () => validateFormula(formula, { mode }),
    [formula, mode],
  );
  const variables = useMemo(
    () => (formulaValidation.ok ? formulaValidation.variables : []),
    [formulaValidation],
  );
  const handleIds = useMemo(
    () => variables.map((_, index) => `in-${index + 1}`),
    [variables],
  );
  const handleOffsets = useMemo(
    () => getFormulaHandleOffsets(handleIds.length),
    [handleIds.length],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftFormula, setDraftFormula] = useState(formula);
  const [showFunctions, setShowFunctions] = useState(false);
  const [showOperators, setShowOperators] = useState(false);

  const draftValidation = useMemo(
    () => validateFormula(draftFormula, { mode }),
    [draftFormula, mode],
  );
  const draftVariables = draftValidation.ok ? draftValidation.variables : [];

  const functionGuide = useMemo(() => getFormulaFunctionGuide(mode), [mode]);
  const operatorGuide = useMemo(() => getFormulaOperatorGuide(mode), [mode]);

  useEffect(() => {
    // Notify react-flow that handles changed so it recomputes internals.
    try {
      updateNodeInternals(nodeId);
    } catch {
      // ignore if not mounted yet
    }
  }, [handleIds.length, nodeId, updateNodeInternals]);

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

    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId
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
  }, [draftFormula, draftValidation, nodeId, setNodes]);

  return {
    formulaValidation,
    variables,
    handleIds,
    handleOffsets,
    isDialogOpen,
    draftFormula,
    setDraftFormula,
    showFunctions,
    setShowFunctions,
    showOperators,
    setShowOperators,
    draftValidation,
    draftVariables,
    handleDialogOpenChange,
    applyFormula,
    functionGuide,
    operatorGuide,
  };
}
