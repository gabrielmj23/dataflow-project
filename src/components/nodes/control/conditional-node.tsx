import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Position,
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { ListChecks } from "lucide-react";

import { BaseNode, BaseNodeHeader } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import NodeSettingsButton from "@/components/ui/node-settings-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

export type ConditionalOperator =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "truthy"
  | "falsy";

export type ConditionalJoin = "AND" | "OR";

export type ConditionalInput = {
  id: string;
  label: string;
};

export type ConditionalRule = {
  variableId: string;
  operator: ConditionalOperator;
  value?: string;
  join?: ConditionalJoin;
};

export type ConditionalCase = {
  label?: string;
  outputToken: number;
  rules: ConditionalRule[];
};

export type ConditionalNodeData = {
  label?: string;
  runtimeError?: string | null;
  inputs?: ConditionalInput[];
  conditions?: ConditionalCase[];
};

const DEFAULT_INPUTS: ConditionalInput[] = [
  { id: "in-1", label: "A" },
];

const DEFAULT_CONDITIONS: ConditionalCase[] = [
  {
    label: "Caso 1",
    outputToken: 1,
    rules: [{ variableId: "in-1", operator: "truthy" }],
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

function isOperator(value: unknown): value is ConditionalOperator {
  return (
    value === "==" ||
    value === "!=" ||
    value === ">" ||
    value === ">=" ||
    value === "<" ||
    value === "<=" ||
    value === "contains" ||
    value === "startsWith" ||
    value === "endsWith" ||
    value === "truthy" ||
    value === "falsy"
  );
}

function requiresTarget(operator: ConditionalOperator): boolean {
  return operator !== "truthy" && operator !== "falsy";
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
      typeof labelRaw === "string" && labelRaw.trim()
        ? labelRaw.trim()
        : String.fromCharCode(65 + index);
    out.push({ id: `in-${index + 1}`, label });
  }

  return out.length > 0 ? out : DEFAULT_INPUTS;
}

function sanitizeConditions(
  value: unknown,
  inputs: ConditionalInput[],
): ConditionalCase[] {
  if (!Array.isArray(value)) return DEFAULT_CONDITIONS;
  const inputIds = new Set(inputs.map((i) => i.id));

  const out: ConditionalCase[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!item || typeof item !== "object") continue;
    const label = (item as { label?: unknown }).label;
    const outputTokenRaw = (item as { outputToken?: unknown }).outputToken;
    const rulesRaw = (item as { rules?: unknown }).rules;

    const rules: ConditionalRule[] = [];
    if (Array.isArray(rulesRaw)) {
      for (let r = 0; r < rulesRaw.length; r += 1) {
        const rule = rulesRaw[r];
        if (!rule || typeof rule !== "object") continue;
        const operator = (rule as { operator?: unknown }).operator;
        const variableIdRaw = (rule as { variableId?: unknown }).variableId;
        if (!isOperator(operator)) continue;
        const variableId = inputIds.has(String(variableIdRaw))
          ? String(variableIdRaw)
          : inputs[0]?.id ?? "in-1";
        const joinRaw = (rule as { join?: unknown }).join;
        const join: ConditionalJoin | undefined =
          joinRaw === "AND" || joinRaw === "OR" ? joinRaw : undefined;
        const valueRaw = (rule as { value?: unknown }).value;
        rules.push({
          variableId,
          operator,
          value: typeof valueRaw === "string" ? valueRaw : undefined,
          ...(join ? { join } : null),
        });
      }
    }

    const outputToken = Number.isFinite(Number(outputTokenRaw))
      ? Math.floor(Number(outputTokenRaw))
      : i + 1;

    out.push({
      label: typeof label === "string" ? label : undefined,
      outputToken,
      rules: rules.length > 0 ? rules : [{ variableId: inputs[0]?.id ?? "in-1", operator: "truthy" }],
    });
  }

  return out.length > 0 ? out : DEFAULT_CONDITIONS;
}

export const ConditionalNode = memo(({ id, data }: NodeProps) => {
  const { label = "Condicional", runtimeError, inputs: rawInputs, conditions: rawConditions } =
    (data ?? {}) as ConditionalNodeData;

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

  const { setNodes } = useReactFlow();
  const setNodeData = useCallback(
    (next: { inputs: ConditionalInput[]; conditions: ConditionalCase[] }) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  inputs: next.inputs,
                  conditions: next.conditions,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftInputs, setDraftInputs] = useState<ConditionalInput[]>(inputs);
  const [draftConditions, setDraftConditions] = useState<ConditionalCase[]>(
    conditions,
  );

  const openDialog = useCallback(() => {
    setDraftInputs(inputs);
    setDraftConditions(conditions);
    setIsDialogOpen(true);
  }, [conditions, inputs]);

  const saveDialog = useCallback(() => {
    const normalizedInputs = sanitizeInputs(draftInputs);
    const normalizedConditions = sanitizeConditions(
      draftConditions,
      normalizedInputs,
    );
    setNodeData({ inputs: normalizedInputs, conditions: normalizedConditions });
    setIsDialogOpen(false);
  }, [draftConditions, draftInputs, setNodeData]);

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
        className="relative flex h-20 w-64 flex-col items-center justify-center rounded-2xl border-orange-600 bg-orange-500 px-5 text-center text-white shadow-md"
      >
        <BaseNodeHeader className="absolute top-1 right-1">
          <NodeSettingsButton onClick={openDialog} />
        </BaseNodeHeader>

        <div className="flex flex-col items-center gap-0.5">
          <div className="text-xl font-bold leading-none">
            <ListChecks className="h-5 w-5" />
          </div>
          <div className="text-sm leading-tight">{label}</div>
          <div className="text-[11px] leading-tight text-white/85">
            {inputs.length} entradas · {conditions.length} condiciones
          </div>
        </div>

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

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Variables de entrada</div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setDraftInputs((prev) => [
                      ...prev,
                      {
                        id: `in-${prev.length + 1}`,
                        label: String.fromCharCode(65 + prev.length),
                      },
                    ])
                  }
                >
                  Agregar variable
                </Button>
              </div>

              <div className="space-y-2">
                {draftInputs.map((input, idx) => (
                  <div
                    key={input.id}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <div className="text-xs text-muted-foreground">
                      {input.id}
                    </div>
                    <Input
                      value={input.label}
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setDraftInputs((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  label: next.trim() ? next : item.label,
                                }
                              : item,
                          ),
                        );
                      }}
                      placeholder={`Variable ${idx + 1}`}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setDraftInputs((prev) =>
                          prev.length <= 1
                            ? prev
                            : prev.filter((_, i) => i !== idx),
                        )
                      }
                      disabled={draftInputs.length <= 1}
                    >
                      Eliminar
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Condiciones</div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setDraftConditions((prev) => [
                      ...prev,
                      {
                        label: `Caso ${prev.length + 1}`,
                        outputToken: prev.length + 1,
                        rules: [
                          {
                            variableId: draftInputs[0]?.id ?? "in-1",
                            operator: "truthy",
                          },
                        ],
                      },
                    ])
                  }
                >
                  Agregar condición
                </Button>
              </div>

              <div className="space-y-4">
                {draftConditions.map((cond, condIdx) => (
                  <div key={`cond-${condIdx}`} className="rounded-md border p-3">
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
                          Token de salida
                        </label>
                        <Input
                          type="number"
                          value={String(cond.outputToken ?? "")}
                          onChange={(e) => {
                            const next = Number(e.currentTarget.value);
                            setDraftConditions((prev) =>
                              prev.map((c, i) =>
                                i === condIdx
                                  ? {
                                      ...c,
                                      outputToken: Number.isFinite(next)
                                        ? Math.floor(next)
                                        : c.outputToken,
                                    }
                                  : c,
                              ),
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {cond.rules.map((rule, ruleIdx) => (
                        <div
                          key={`rule-${condIdx}-${ruleIdx}`}
                          className="grid grid-cols-1 gap-2 rounded-md bg-muted/20 p-2 sm:grid-cols-5"
                        >
                          {ruleIdx > 0 ? (
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-900">
                                Unión
                              </label>
                              <Select
                                value={rule.join ?? "AND"}
                                onValueChange={(value) => {
                                  if (value !== "AND" && value !== "OR") return;
                                  setDraftConditions((prev) =>
                                    prev.map((c, i) =>
                                      i === condIdx
                                        ? {
                                            ...c,
                                            rules: c.rules.map((r, ri) =>
                                              ri === ruleIdx
                                                ? { ...r, join: value }
                                                : r,
                                            ),
                                          }
                                        : c,
                                    ),
                                  );
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="AND" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND">AND</SelectItem>
                                  <SelectItem value="OR">OR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="hidden sm:block" />
                          )}

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-900">
                              Variable
                            </label>
                            <Select
                              value={rule.variableId}
                              onValueChange={(value) => {
                                setDraftConditions((prev) =>
                                  prev.map((c, i) =>
                                    i === condIdx
                                      ? {
                                          ...c,
                                          rules: c.rules.map((r, ri) =>
                                            ri === ruleIdx
                                              ? { ...r, variableId: value }
                                              : r,
                                          ),
                                        }
                                      : c,
                                  ),
                                );
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Variable" />
                              </SelectTrigger>
                              <SelectContent>
                                {draftInputs.map((input) => (
                                  <SelectItem key={input.id} value={input.id}>
                                    {input.label} ({input.id})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-900">
                              Operador
                            </label>
                            <Select
                              value={rule.operator}
                              onValueChange={(value) => {
                                if (!isOperator(value)) return;
                                setDraftConditions((prev) =>
                                  prev.map((c, i) =>
                                    i === condIdx
                                      ? {
                                          ...c,
                                          rules: c.rules.map((r, ri) =>
                                            ri === ruleIdx
                                              ? {
                                                  ...r,
                                                  operator: value,
                                                  value: requiresTarget(value)
                                                    ? r.value
                                                    : undefined,
                                                }
                                              : r,
                                          ),
                                        }
                                      : c,
                                  ),
                                );
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Operador" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="truthy">Es verdadero</SelectItem>
                                <SelectItem value="falsy">Es falso</SelectItem>
                                <SelectItem value="==">=</SelectItem>
                                <SelectItem value="!=">≠</SelectItem>
                                <SelectItem value=">">&gt;</SelectItem>
                                <SelectItem value=">=">&gt;=</SelectItem>
                                <SelectItem value="<">&lt;</SelectItem>
                                <SelectItem value="<=">&lt;=</SelectItem>
                                <SelectItem value="contains">Contiene</SelectItem>
                                <SelectItem value="startsWith">Empieza con</SelectItem>
                                <SelectItem value="endsWith">Termina con</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-900">
                              Valor
                            </label>
                            <Input
                              value={rule.value ?? ""}
                              disabled={!requiresTarget(rule.operator)}
                              placeholder={requiresTarget(rule.operator) ? "Valor" : "-"}
                              onChange={(e) => {
                                const next = e.currentTarget.value;
                                setDraftConditions((prev) =>
                                  prev.map((c, i) =>
                                    i === condIdx
                                      ? {
                                          ...c,
                                          rules: c.rules.map((r, ri) =>
                                            ri === ruleIdx
                                              ? { ...r, value: next }
                                              : r,
                                          ),
                                        }
                                      : c,
                                  ),
                                );
                              }}
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                setDraftConditions((prev) =>
                                  prev.map((c, i) =>
                                    i === condIdx
                                      ? {
                                          ...c,
                                          rules:
                                            c.rules.length <= 1
                                              ? c.rules
                                              : c.rules.filter((_, ri) => ri !== ruleIdx),
                                        }
                                      : c,
                                  ),
                                )
                              }
                              disabled={cond.rules.length <= 1}
                            >
                              Quitar
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setDraftConditions((prev) =>
                            prev.map((c, i) =>
                              i === condIdx
                                ? {
                                    ...c,
                                    rules: [
                                      ...c.rules,
                                      {
                                        variableId: draftInputs[0]?.id ?? "in-1",
                                        operator: "truthy",
                                        join: "AND",
                                      },
                                    ],
                                  }
                                : c,
                            ),
                          )
                        }
                      >
                        Agregar regla
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
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
        </DialogContent>
      </Dialog>
    </>
  );
});

ConditionalNode.displayName = "ConditionalNode";
