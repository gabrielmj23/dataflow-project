import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { ToggleRight } from "lucide-react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";
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
  const customLabel = typeof condition.label === "string" ? condition.label.trim() : "";
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
    [conditions]
  );

  const outputLabels = useMemo(
    () => conditions.map((condition) => describeCondition(condition)),
    [conditions],
  );

  const outputCount = outputHandleIds.length;

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
            : node
        )
      );
    },
    [id, setNodes]
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftConditions, setDraftConditions] = useState<SwitchCondition[]>(
    () => conditions
  );

  const openDialog = useCallback(() => {
    setDraftConditions(conditions);
    setIsDialogOpen(true);
  }, [conditions]);

  const headingId = useId();

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

  const shellStyle: React.CSSProperties = { width: `${computedWidthPx}px`, minHeight: `${computedHeightPx}px` };

    const iconComponent = (
    <div
      className="cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
      onClick={(e) => {
        e.stopPropagation();
        setIsDialogOpen(true);
      }}
    >
      <ToggleRight className="h-5 w-5" />
    </div>
  );

  return (
    <>
      <ControlRectNodeShell
        nodeType="switch"
        icon={iconComponent}
        label={label}
        className="pl-4 pr-14"
        style={shellStyle}
        contentClassName="items-start text-left"
        labelClassName="text-base"
        outputLabelClassName="text-[10px] max-w-[64px]"
        variant="singleInMultiOut"
        outputCount={outputCount}
        outputHandleIds={outputHandleIds}
        outputLabels={outputLabels}
        onConfigClick={openDialog}
        runtimeError={runtimeError}
      />

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
                            : prev.filter((_, i) => i !== idx)
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
                                : c
                            )
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
                                : c
                            )
                          );
                        }}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecciona un operador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Lógico</SelectLabel>
                            <SelectItem value="truthy">Es verdadero</SelectItem>
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
                              i === idx ? { ...c, target: next } : c
                            )
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
                      : DEFAULT_CONDITIONS
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
