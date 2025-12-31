import { memo, useCallback, useId, useMemo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { ToggleRight } from "lucide-react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SwitchNodeData = {
  label?: string;
  conditions?: SwitchCondition[];
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
    if (!isOperator(operator)) continue;

    out.push({
      operator,
      target: typeof target === "string" ? target : undefined,
    });
  }

  return out;
}

function requiresTarget(operator: SwitchOperator): boolean {
  return operator !== "truthy" && operator !== "falsy";
}

export const SwitchNode = memo(({ id, data }: NodeProps) => {
  const { label = "Switch", conditions: rawConditions } = (data ??
    {}) as SwitchNodeData;

  const conditions = useMemo(() => {
    const parsed = sanitizeConditions(rawConditions);
    return parsed.length > 0 ? parsed : DEFAULT_CONDITIONS;
  }, [rawConditions]);

  const outputCount = Math.max(1, conditions.length);

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

  return (
    <>
      <ControlRectNodeShell
        icon={<ToggleRight className="h-5 w-5" />}
        label={label}
        variant="singleInMultiOut"
        outputCount={outputCount}
        onConfigClick={openDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle id={headingId}>Configurar Switch</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define N condiciones. El nodo emitirá el valor de entrada por la
              primera salida cuya condición sea verdadera.
            </p>

            <div className="space-y-3">
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

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-900">
                        Operador
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={cond.operator}
                        onChange={(e) => {
                          const next = e.currentTarget.value as SwitchOperator;
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
                        <optgroup label="Lógico">
                          <option value="truthy">Es verdadero</option>
                          <option value="falsy">Es falso</option>
                        </optgroup>
                        <optgroup label="Texto">
                          <option value="contains">Contiene</option>
                          <option value="startsWith">Inicia con</option>
                          <option value="endsWith">Termina con</option>
                        </optgroup>
                        <optgroup label="Comparación">
                          <option value="==">Igual (==)</option>
                          <option value="!=">Distinto (!=)</option>
                          <option value=">">Mayor (&gt;)</option>
                          <option value=">=">Mayor o igual (&gt;=)</option>
                          <option value="<">Menor (&lt;)</option>
                          <option value="<=">Menor o igual (&lt;=)</option>
                        </optgroup>
                      </select>
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

            <div className="flex items-center justify-between">
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

              <div className="flex items-center justify-end gap-2">
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

SwitchNode.displayName = "SwitchNode";
