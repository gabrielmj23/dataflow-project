import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { globalIsDragging } from "@/lib/globalRefs";
import {
  Position,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { ListChecks } from "lucide-react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";
import { validateFormula } from "@/utils/formula";

export type ConditionalInput = {
  id: string;
  label: string;
};

export type ConditionalCase = {
  label?: string;
  outputToken: string;
  formula?: string;
};

export type ConditionalNodeData = {
  label?: string;
  runtimeError?: string | null;
  inputs?: ConditionalInput[];
  conditions?: ConditionalCase[];
};

const DEFAULT_INPUTS: ConditionalInput[] = [{ id: "in-1", label: "a" }];

const DEFAULT_CONDITIONS: ConditionalCase[] = [
  {
    label: "Caso 1",
    outputToken: "Salida 1",
    formula: "a",
  },
];

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return ["50%"];

  const start = 15;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

function sanitizeInputs(value: unknown): ConditionalInput[] {
  if (!Array.isArray(value)) return DEFAULT_INPUTS;

  const out: ConditionalInput[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const labelRaw =
      item && typeof item === "object"
        ? (item as { label?: unknown }).label
        : undefined;
    const label =
      typeof labelRaw === "string"
        ? labelRaw.trim()
        : String.fromCharCode(97 + index);
    out.push({ id: `in-${index + 1}`, label });
  }

  return out.length > 0 ? out : DEFAULT_INPUTS;
}

function normalizeConditionExpression(raw: string): string {
  let expr = String(raw ?? "");

  // Replace Spanish logical keywords with mathjs-friendly operators.
  expr = expr.replace(/\b[yY]\b/g, " and ");
  expr = expr.replace(/\b[oO]\b/g, " or ");

  // Replace lone '=' (not part of >=, <=, !=, ==) with '=='.
  expr = expr.replace(/(^|[^<>!=])=([^=])/g, "$1==$2");

  return expr.trim();
}

function sanitizeConditions(
  value: unknown,
  inputs: ConditionalInput[],
): ConditionalCase[] {
  if (!Array.isArray(value)) return DEFAULT_CONDITIONS;

  const out: ConditionalCase[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!item || typeof item !== "object") continue;
    const label = (item as { label?: unknown }).label;
    const outputTokenRaw = (item as { outputToken?: unknown }).outputToken;

    const formulaRaw = (item as { formula?: unknown }).formula;
    const defaultFormula = inputs[0]?.label ?? "a";
    const formula =
      typeof formulaRaw === "string" && formulaRaw.trim().length > 0
        ? normalizeConditionExpression(formulaRaw)
        : defaultFormula;

    const outputToken =
      typeof outputTokenRaw === "string" && outputTokenRaw.trim()
        ? outputTokenRaw.trim()
        : `Salida ${i + 1}`;

    out.push({
      label: typeof label === "string" ? label : undefined,
      outputToken,
      formula,
    });
  }

  return out.length > 0 ? out : DEFAULT_CONDITIONS;
}

export const ConditionalNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Condicional",
    runtimeError,
    inputs: rawInputs,
    conditions: rawConditions,
  } = (data ?? {}) as ConditionalNodeData;
  const pairId = (data as { pairId?: string | null })?.pairId ?? null;
  const pairOffsetY = (data as { pairOffsetY?: number })?.pairOffsetY ?? 160;

  const inputs = useMemo(() => sanitizeInputs(rawInputs), [rawInputs]);
  const conditions = useMemo(
    () => sanitizeConditions(rawConditions, inputs),
    [rawConditions, inputs],
  );

  const inputOffsets = offsets(inputs.length);

  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inputs.length, updateNodeInternals]);

  const minHeight = useMemo(
    () => 110 + Math.max(0, inputs.length - 2) * 8,
    [inputs.length],
  );

  const { setNodes } = useReactFlow();
  const nodes = useStore((state) => state.nodes);

  // Keep paired selector at a consistent vertical gap as this node grows.
  const pairAdjustTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pairId) return;
    const self = nodes.find((n) => n.id === id);
    if (!self) return;

    const targetY =
      (self.position?.y ?? 0) + minHeight + Math.max(20, pairOffsetY - 110);

    // If any node is currently being dragged, avoid scheduling adjustments —
    // this prevents the paired selector from jumping while the user is
    // actively moving nodes.
    if (globalIsDragging.current) return;

    // Debounce actual repositioning so that if many node updates happen
    // (e.g., while dragging), we don't continuously mutate node positions
    // — instead we wait for a short pause and then apply the adjustment.
    if (pairAdjustTimeoutRef.current !== null) {
      window.clearTimeout(pairAdjustTimeoutRef.current);
      pairAdjustTimeoutRef.current = null;
    }

    pairAdjustTimeoutRef.current = window.setTimeout(() => {
      setNodes((prev) =>
        prev.map((node) => {
          const isPairedSelector =
            node.type === "selector" &&
            (node.data as { pairId?: string | null })?.pairId === pairId;
          if (!isPairedSelector) return node;
          const currentY = node.position?.y ?? 0;
          const currentX = node.position?.x ?? 0;

          // If this selector is currently selected or being dragged, skip moving it.
          if (node.selected === true || node.dragging === true) return node;

          const centerOffsetX = 32; // half difference between w-72 and w-56
          const targetX = (self.position?.x ?? 0) + centerOffsetX;

          if (
            Math.abs(currentY - targetY) < 1 &&
            Math.abs(currentX - targetX) < 1
          )
            return node;

          return {
            ...node,
            position: {
              x: targetX,
              y: targetY,
            },
          };
        }),
      );
      pairAdjustTimeoutRef.current = null;
    }, 120);

    return () => {
      if (pairAdjustTimeoutRef.current !== null) {
        window.clearTimeout(pairAdjustTimeoutRef.current);
        pairAdjustTimeoutRef.current = null;
      }
    };
  }, [id, minHeight, nodes, pairId, pairOffsetY, setNodes]);
  const connectedInputCount = inputs.length;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftInputs, setDraftInputs] = useState<ConditionalInput[]>(inputs);
  const [draftConditions, setDraftConditions] =
    useState<ConditionalCase[]>(conditions);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const validationResults = useMemo(() => {
    const inputNames = new Set(
      draftInputs.map((i) =>
        String(i.label ?? "")
          .trim()
          .toLowerCase(),
      ),
    );

    return draftConditions.map((cond) => {
      const normalized = normalizeConditionExpression(cond.formula ?? "");
      const validation = validateFormula(normalized);
      const usedVars = validation.variables
        .map((v) => String(v).trim())
        .filter(Boolean);
      const unknownVars = usedVars.filter(
        (v) => !inputNames.has(v.toLowerCase()),
      );
      return { normalized, validation, unknownVars };
    });
  }, [draftConditions, draftInputs]);

  const openDialog = useCallback(() => {
    setDraftInputs(inputs);
    setDraftConditions(conditions);
    setDialogError(null);
    setIsDialogOpen(true);
  }, [conditions, inputs]);

  const saveDialog = useCallback(() => {
    const hasInvalid = validationResults.some((res) => !res.validation.ok);
    if (hasInvalid) {
      setDialogError("Revisa las condiciones: hay expresiones inválidas.");
      return;
    }
    // Determine required input variables from the validated conditions.
    // Use the union of all variables referenced in the condition expressions
    // so the node exposes exactly the inputs that are used.
    const requiredVars = Array.from(
      new Set(
        validationResults
          .flatMap((r) => r.validation.variables ?? [])
          .map((v) => String(v).trim())
          .filter(Boolean),
      ),
    );

    let mergedInputs: ConditionalInput[] = [];
    if (requiredVars.length > 0) {
      mergedInputs = requiredVars.map((label, idx) => ({
        id: `in-${idx + 1}`,
        label,
      }));
    } else {
      // Fallback to sanitized/default inputs when no variables are used.
      mergedInputs = sanitizeInputs(rawInputs ?? inputs);
    }
    const normalizedConditions = draftConditions.map((cond, idx) => ({
      ...cond,
      formula: validationResults[idx]?.normalized ?? cond.formula ?? "",
    }));

    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...(node.data ?? {}),
                inputs: mergedInputs,
                conditions: normalizedConditions,
              },
            }
          : node,
      ),
    );
    setDialogError(null);
    setIsDialogOpen(false);
  }, [draftConditions, id, inputs, rawInputs, setNodes, validationResults]);

  const titleId = useId();

  const maskFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) =>
    getPortTypeMask({
      nodeType: "conditional",
      handleType: params.handleType,
      handleId: params.handleId ?? null,
    });

  const typeFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) => maskToVisualPortDataType(maskFor(params));

  return (
    <>
      <BaseNode
        runtimeError={runtimeError}
        onConfigClick={openDialog}
        className="relative flex w-72 flex-col items-center justify-center rounded-2xl border-orange-600 bg-orange-500 px-5 text-center text-white shadow-md"
        style={{ minHeight: `${minHeight}px` }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-xl font-bold leading-none">
            <ListChecks className="h-5 w-5" />
          </div>
          <div className="text-sm leading-tight">{label}</div>
          <div className="text-[11px] leading-tight text-white/85">
            {connectedInputCount} entradas · {conditions.length} condiciones
          </div>
        </div>

        {inputs.map((input, index) => {
          const offset = inputOffsets[index] ?? "50%";

          const trimmed = String(input.label ?? "").trim();
          const len = Math.max(0, trimmed.length);
          // Compute width: small pill for single letter, grow with length, cap at 120px
          const widthPx = len <= 1 ? 36 : Math.min(120, 12 + len * 8);

          return (
            <Input
              key={`label-${input.id}`}
              value={input.label}
              readOnly
              tabIndex={-1}
              className="nodrag absolute h-6 -translate-y-1/2 border-0 bg-transparent px-2 text-left text-[10px] text-white placeholder:text-white/60 focus:outline-none pointer-events-none shadow-none"
              style={{
                top: `calc(${offset} + 9px)`,
                left: "12px",
                width: `${widthPx}px`,
                transform: "translate(0, -50%)",
              }}
            />
          );
        })}

        {inputs.map((input, index) => {
          const offset = inputOffsets[index] ?? "50%";
          const mask = maskFor({ handleType: "target", handleId: input.id });
          const dt = maskToVisualPortDataType(mask);
          return (
            <CustomTypedHandle
              key={input.id}
              type="target"
              position={Position.Left}
              id={input.id}
              style={{ top: offset }}
              dataType={dt}
              typeMask={mask}
              className="absolute -left-1 h-2 w-2 -translate-y-1/2"
              indicatorClassName="border-orange-600"
            />
          );
        })}

        <CustomTypedHandle
          type="source"
          position={Position.Bottom}
          id="out"
          dataType={typeFor({ handleType: "source", handleId: "out" })}
          typeMask={maskFor({ handleType: "source", handleId: "out" })}
          className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2"
          indicatorClassName="border-orange-600"
        />
      </BaseNode>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle id={titleId}>Configurar Condicional</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Condiciones</div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setDraftConditions((prev) => [
                      ...prev,
                      {
                        label: `Caso ${prev.length + 1}`,
                        outputToken: `Salida ${prev.length + 1}`,
                        formula: draftInputs[0]?.label ?? "a",
                      },
                    ])
                  }
                >
                  Agregar condición
                </Button>
              </div>

              <div className="space-y-4">
                {draftConditions.map((cond, condIdx) => {
                  const validation = validationResults[condIdx]?.validation;
                  const normalized =
                    validationResults[condIdx]?.normalized ?? "";
                  const variablesText =
                    validation?.variables && validation.variables.length > 0
                      ? `Variables: ${validation.variables.join(", ")}`
                      : "Sin variables detectadas";

                  return (
                    <div
                      key={`cond-${condIdx}`}
                      className="rounded-md border p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-medium">
                          Condición {condIdx + 1}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setDraftConditions((prev) =>
                              prev.length <= 1
                                ? prev
                                : prev.filter((_, i) => i !== condIdx),
                            )
                          }
                          disabled={draftConditions.length <= 1}
                        >
                          Eliminar
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-900">
                            Etiqueta
                          </label>
                          <Input
                            value={cond.label ?? ""}
                            placeholder={`Caso ${condIdx + 1}`}
                            onChange={(e) => {
                              const next = e.currentTarget.value;
                              setDraftConditions((prev) =>
                                prev.map((c, i) =>
                                  i === condIdx
                                    ? {
                                        ...c,
                                        label: next.trim() ? next : undefined,
                                      }
                                    : c,
                                ),
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-900">
                            Salida
                          </label>
                          <Input
                            value={cond.outputToken ?? ""}
                            placeholder={`Salida ${condIdx + 1}`}
                            onChange={(e) => {
                              const next = e.currentTarget.value;
                              setDraftConditions((prev) =>
                                prev.map((c, i) =>
                                  i === condIdx
                                    ? {
                                        ...c,
                                        outputToken: next.trim()
                                          ? next
                                          : c.outputToken,
                                      }
                                    : c,
                                ),
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-900">
                            Expresión
                          </label>
                          <textarea
                            value={cond.formula ?? ""}
                            placeholder="a > b y c = 5"
                            onChange={(e) => {
                              const next = e.currentTarget.value;
                              setDraftConditions((prev) =>
                                prev.map((c, i) =>
                                  i === condIdx
                                    ? {
                                        ...c,
                                        formula: next,
                                      }
                                    : c,
                                ),
                              );
                              setDialogError(null);
                            }}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            rows={2}
                          />
                          <div className="mt-1 text-[11px] text-gray-600">
                            Usa Y/O para and/or. Se normaliza a:{" "}
                            <span className="font-semibold">
                              {normalized || ""}
                            </span>
                          </div>
                          {validation?.ok ? (
                            <div className="mt-1 text-[11px] text-green-700">
                              {variablesText}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-red-600">
                              {validation?.error ?? "Expresión inválida"}
                              {Array.isArray(validation?.variables) &&
                              validation?.variables.length > 0 ? (
                                <div className="mt-1 text-[11px]">
                                  Variables detectadas:{" "}
                                  {validation.variables.join(", ")}
                                </div>
                              ) : null}
                              {Array.isArray(
                                validationResults[condIdx]?.unknownVars,
                              ) &&
                              validationResults[condIdx].unknownVars.length >
                                0 ? (
                                <div className="mt-1 text-[11px] font-medium text-red-700">
                                  Variables no definidas:{" "}
                                  {validationResults[condIdx].unknownVars.join(
                                    ", ",
                                  )}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <div className="flex items-center gap-2 w-full">
              {dialogError ? (
                <div className="self-center text-sm text-red-600">
                  {dialogError}
                </div>
              ) : null}
              <div className="ml-auto flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={saveDialog}>
                  Guardar
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

ConditionalNode.displayName = "ConditionalNode";
