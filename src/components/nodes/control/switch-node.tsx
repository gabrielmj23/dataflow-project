import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Position,
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { ToggleRight } from "lucide-react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { getNodeDescription } from "@/flow/node-palette";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SwitchNodeData = {
  label?: string;
  conditions?: SwitchCondition[];
  runtimeError?: string | null;
};

export type SwitchOperator =
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

export type SwitchCondition = {
  /** Optional user-facing label for this condition (used on edge labels). */
  label?: string;
  operator: SwitchOperator;
  /**
   * Raw target value (entered as text). The engine will interpret it based on
   * the operator and runtime value type.
   */
  target?: string;
};

const DEFAULT_CONDITIONS: SwitchCondition[] = [
  { operator: "truthy" },
  { operator: "falsy" },
];

function isOperator(value: unknown): value is SwitchOperator {
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

function sanitizeConditions(value: unknown): SwitchCondition[] {
  if (!Array.isArray(value)) return [];

  const out: SwitchCondition[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const operator = (item as { operator?: unknown }).operator;
    const target = (item as { target?: unknown }).target;
    const label = (item as { label?: unknown }).label;
    if (!isOperator(operator)) continue;

    out.push({
      operator,
      label: typeof label === "string" ? label : undefined,
      target: typeof target === "string" ? target : undefined,
    });
  }

  return out;
}

function requiresTarget(operator: SwitchOperator): boolean {
  return operator !== "truthy" && operator !== "falsy";
}

function describeCondition(condition: SwitchCondition): string {
  const customLabel =
    typeof condition.label === "string" ? condition.label.trim() : "";
  if (customLabel) return customLabel;

  const target =
    typeof condition.target === "string"
      ? condition.target
      : String(condition.target ?? "");

  switch (condition.operator) {
    case "truthy":
      return "Verdadero";
    case "falsy":
      return "Falso";
    case "contains":
      return `Contiene ${target}`;
    case "startsWith":
      return `Inicia con ${target}`;
    case "endsWith":
      return `Termina con ${target}`;
    case "==":
    case "!=":
    case ">":
    case ">=":
    case "<":
    case "<=":
      return `${condition.operator} ${target}`;
    default:
      return "Condición";
  }
}

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [];
  if (safeCount === 1) return ["50%"];

  const start = 15;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export const SwitchNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Switch",
    conditions: rawConditions,
    runtimeError,
  } = (data ?? {}) as SwitchNodeData;

  const conditions = useMemo(() => {
    const parsed = sanitizeConditions(rawConditions);
    return parsed.length > 0 ? parsed : DEFAULT_CONDITIONS;
  }, [rawConditions]);

  const outputHandleIds = useMemo(
    () => [...conditions.map((_, i) => `out-${i + 1}`)],
    [conditions],
  );

  const outputLabels = useMemo(
    () => conditions.map((condition) => describeCondition(condition)),
    [conditions],
  );

  const outputCount = outputHandleIds.length;
  const outOffsets = useMemo(() => offsets(outputCount), [outputCount]);

  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, outputCount, updateNodeInternals]);

  const { setNodes } = useReactFlow();
  const setConditions = useCallback(
    (next: SwitchCondition[]) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  conditions: next,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftConditions, setDraftConditions] = useState<SwitchCondition[]>(
    () => conditions,
  );

  const openDialog = useCallback(() => {
    setDraftConditions(conditions);
    setIsDialogOpen(true);
  }, [conditions]);

  const headingId = useId();

  const maskFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) =>
    getPortTypeMask({
      nodeType: "switch",
      handleType: params.handleType,
      handleId: params.handleId ?? null,
    });

  const typeFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) => maskToVisualPortDataType(maskFor(params));

  const computedWidthPx = useMemo(() => {
    const base = 152; // matches previous w-38 (~9.5rem = 152px)
    const extraPerOutput = 18; // pixels to add per output beyond 2
    const extra = Math.max(0, outputCount - 2) * extraPerOutput;
    return base + extra;
  }, [outputCount]);
  const computedHeightPx = useMemo(() => {
    const baseH = 72; // matches min-h-[72px]
    const extraPerOutputH = 18; // px per extra output beyond 2
    const extraH = Math.max(0, outputCount - 2) * extraPerOutputH;
    return baseH + extraH;
  }, [outputCount]);

  const shellStyle: React.CSSProperties = {
    width: `${computedWidthPx}px`,
    minHeight: `${computedHeightPx}px`,
  };

  return (
    <>
      <BaseNode
        runtimeError={runtimeError}
        infoDescription={getNodeDescription("switch") ?? undefined}
        onConfigClick={openDialog}
        className="relative flex flex-col items-center justify-center rounded-2xl border-lime-700 bg-lime-600 pl-4 pr-14 text-left text-white shadow-md"
        style={shellStyle}
      >
        <div className="flex w-full flex-col items-start gap-0.5">
          <button
            type="button"
            className="nodrag nopan transition-transform hover:scale-110 focus-visible:outline-none focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              openDialog();
            }}
          >
            <ToggleRight className="h-5 w-5" />
          </button>
          <div className="text-base font-medium leading-tight">{label}</div>
        </div>

        <CustomTypedHandle
          type="target"
          position={Position.Left}
          id="in"
          dataType={typeFor({ handleType: "target", handleId: "in" })}
          typeMask={maskFor({ handleType: "target", handleId: "in" })}
          className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2"
          indicatorClassName="border-lime-700"
        />

        {outOffsets.map((offset, index) => {
          const id = outputHandleIds[index];
          const mask = maskFor({ handleType: "source", handleId: id });
          const dt = maskToVisualPortDataType(mask);
          const outputLabel = outputLabels[index];
          return (
            <div key={`out-handle-${id}`} className="contents">
              {outputLabel && (
                <div
                  className="pointer-events-none absolute right-3 max-w-16 -translate-y-1/2 truncate text-[10px] font-medium leading-none text-white/90"
                  style={{ top: offset }}
                >
                  {outputLabel}
                </div>
              )}
              <CustomTypedHandle
                type="source"
                position={Position.Right}
                style={{ top: offset }}
                id={id}
                dataType={dt}
                typeMask={mask}
                className="absolute -right-1 h-2 w-2 -translate-y-1/2"
                indicatorClassName="border-lime-700"
              />
            </div>
          );
        })}
      </BaseNode>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle id={headingId}>Configurar Switch</DialogTitle>
          </DialogHeader>

          <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">
              Define N condiciones. El nodo emitirá el valor de entrada por la
              primera salida cuya condición sea verdadera.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Condiciones</div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setDraftConditions((prev) => [
                      ...prev,
                      { operator: "==", target: "" },
                    ])
                  }
                >
                  Agregar condición
                </Button>
              </div>

              <div className="space-y-4">
                {draftConditions.map((cond, idx) => (
                  <div key={`cond-${idx}`} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-medium">
                        Condición {idx + 1} (Salida {idx + 1})
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setDraftConditions((prev) =>
                            prev.length <= 1
                              ? prev
                              : prev.filter((_, i) => i !== idx),
                          );
                        }}
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
                          placeholder={`Ej: Caso ${idx + 1}`}
                          onChange={(e) => {
                            const next = e.currentTarget.value;
                            setDraftConditions((prev) =>
                              prev.map((c, i) =>
                                i === idx
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
                          Operador
                        </label>
                        <Select
                          value={cond.operator}
                          onValueChange={(value: string) => {
                            if (!isOperator(value)) return;
                            const next = value;
                            setDraftConditions((prev) =>
                              prev.map((c, i) =>
                                i === idx
                                  ? {
                                      ...c,
                                      operator: next,
                                      target: requiresTarget(next)
                                        ? c.target
                                        : undefined,
                                    }
                                  : c,
                              ),
                            );
                          }}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selecciona un operador" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Lógico</SelectLabel>
                              <SelectItem value="truthy">
                                Es verdadero
                              </SelectItem>
                              <SelectItem value="falsy">Es falso</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Texto</SelectLabel>
                              <SelectItem value="contains">Contiene</SelectItem>
                              <SelectItem value="startsWith">
                                Inicia con
                              </SelectItem>
                              <SelectItem value="endsWith">
                                Termina con
                              </SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Comparación</SelectLabel>
                              <SelectItem value="==">Igual (==)</SelectItem>
                              <SelectItem value="!=">Distinto (!=)</SelectItem>
                              <SelectItem value=">">Mayor (&gt;)</SelectItem>
                              <SelectItem value=">=">
                                Mayor o igual (&gt;=)
                              </SelectItem>
                              <SelectItem value="<">Menor (&lt;)</SelectItem>
                              <SelectItem value="<=">
                                Menor o igual (&lt;=)
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-900">
                          Valor objetivo
                        </label>
                        <Input
                          value={cond.target ?? ""}
                          placeholder={
                            requiresTarget(cond.operator)
                              ? "Ej: 10, true, hola"
                              : "(no aplica)"
                          }
                          disabled={!requiresTarget(cond.operator)}
                          onChange={(e) => {
                            const next = e.currentTarget.value;
                            setDraftConditions((prev) =>
                              prev.map((c, i) =>
                                i === idx ? { ...c, target: next } : c,
                              ),
                            );
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraftConditions(conditions);
                  setIsDialogOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setConditions(
                    draftConditions.length > 0
                      ? draftConditions
                      : DEFAULT_CONDITIONS,
                  );
                  setIsDialogOpen(false);
                }}
              >
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

SwitchNode.displayName = "SwitchNode";
