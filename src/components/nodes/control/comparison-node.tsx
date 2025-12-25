import {
  memo,
  useCallback,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ComparisonOperator = "==" | "!=" | "<" | "<=" | ">" | ">=";

const OPERATORS: Array<{
  op: ComparisonOperator;
  label: string;
  icon: ReactNode;
}> = [
  {
    op: "==",
    label: "Igual",
    icon: <span className="-rotate-90 text-2xl font-bold">=</span>,
  },
  {
    op: "!=",
    label: "Distinto",
    icon: <span className="-rotate-90 text-2xl font-bold">≠</span>,
  },
  {
    op: "<",
    label: "Menor",
    icon: <span className="rotate-90 text-2xl font-bold">{"<"}</span>,
  },
  {
    op: "<=",
    label: "Menor o igual",
    icon: <span className="rotate-90 text-2xl font-bold">≤</span>,
  },
  {
    op: ">",
    label: "Mayor",
    icon: <span className="-rotate-90 text-2xl font-bold">{">"}</span>,
  },
  {
    op: ">=",
    label: "Mayor o igual",
    icon: <span className="-rotate-90 text-2xl font-bold">≥</span>,
  },
];

export type ComparisonNodeData = {
  label?: string;
  operator?: ComparisonOperator;
};

export const ComparisonNode = memo(({ id, data }: NodeProps) => {
  const { label = "Comparación", operator: rawOperator } = (data ??
    {}) as ComparisonNodeData;

  const operator = useMemo<ComparisonOperator>(() => {
    if (
      rawOperator === "==" ||
      rawOperator === "!=" ||
      rawOperator === "<" ||
      rawOperator === "<=" ||
      rawOperator === ">" ||
      rawOperator === ">="
    ) {
      return rawOperator;
    }
    return "==";
  }, [rawOperator]);

  const { setNodes } = useReactFlow();
  const setOperator = useCallback(
    (nextOperator: ComparisonOperator) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  operator: nextOperator,
                },
              }
            : node
        )
      );
    },
    [id, setNodes]
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftOperator, setDraftOperator] =
    useState<ComparisonOperator>(operator);

  const openDialog = useCallback(() => {
    setDraftOperator(operator);
    setIsDialogOpen(true);
  }, [operator]);

  const headingId = useId();

  return (
    <>
      <ControlRectNodeShell
        icon={OPERATORS.find(({ op }) => op === operator)?.icon ?? "?"}
        label={label}
        onConfigClick={openDialog}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle id={headingId}>Configurar comparación</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elige cómo comparar los dos valores de entrada.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {OPERATORS.map(({ op, label: opLabel, icon }) => {
                const isSelected = draftOperator === op;
                return (
                  <Button
                    key={op}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className="h-auto justify-start px-3 py-2"
                    onClick={() => setDraftOperator(op)}
                  >
                    <span className="mr-2 text-base font-extrabold">
                      {icon}
                    </span>
                    <span className="text-sm font-medium">{opLabel}</span>
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraftOperator(operator);
                  setIsDialogOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOperator(draftOperator);
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

ComparisonNode.displayName = "ComparisonNode";
