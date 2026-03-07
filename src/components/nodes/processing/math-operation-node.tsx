import {
  memo,
  useCallback,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Divide, Minus, Percent, Plus, X } from "lucide-react";

import { NODE_TYPES } from "@/common/constants";
import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type MathOperationKind =
  | typeof NODE_TYPES.SUM_NODE
  | typeof NODE_TYPES.SUBTRACT_NODE
  | typeof NODE_TYPES.MULTIPLY_NODE
  | typeof NODE_TYPES.DIVIDE_NODE
  | typeof NODE_TYPES.MOD_NODE
  | typeof NODE_TYPES.POWER_NODE;

type MathOperationOption = {
  op: MathOperationKind;
  label: string;
  icon: ReactNode;
};

const OPERATIONS: MathOperationOption[] = [
  { op: NODE_TYPES.SUM_NODE, label: "Sumar", icon: <Plus className="h-4 w-4" /> },
  { op: NODE_TYPES.SUBTRACT_NODE, label: "Restar", icon: <Minus className="h-4 w-4" /> },
  { op: NODE_TYPES.MULTIPLY_NODE, label: "Multiplicar", icon: <X className="h-4 w-4" /> },
  { op: NODE_TYPES.DIVIDE_NODE, label: "Dividir", icon: <Divide className="h-4 w-4" /> },
  { op: NODE_TYPES.MOD_NODE, label: "Resto", icon: <Percent className="h-4 w-4" /> },
  {
    op: NODE_TYPES.POWER_NODE,
    label: "Potencia",
    icon: <span className="text-sm font-normal leading-none">xⁿ</span>,
  },
];

function isMathOperation(value: unknown): value is MathOperationKind {
  return (
    value === NODE_TYPES.SUM_NODE ||
    value === NODE_TYPES.SUBTRACT_NODE ||
    value === NODE_TYPES.MULTIPLY_NODE ||
    value === NODE_TYPES.DIVIDE_NODE ||
    value === NODE_TYPES.MOD_NODE ||
    value === NODE_TYPES.POWER_NODE
  );
}

export type MathOperationNodeData = {
  label?: string;
  operation?: MathOperationKind;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const MathOperationNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Operación Matemática",
    operation: rawOperation,
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as MathOperationNodeData;

  const operation = useMemo<MathOperationKind>(
    () => (isMathOperation(rawOperation) ? rawOperation : NODE_TYPES.SUM_NODE),
    [rawOperation],
  );

  const selected =
    OPERATIONS.find((entry) => entry.op === operation) ?? OPERATIONS[0];

  const { setNodes } = useReactFlow();
  const setOperation = useCallback(
    (nextOperation: MathOperationKind) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  operation: nextOperation,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Operación Matemática",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftOperation, setDraftOperation] = useState<MathOperationKind>(
    operation,
  );

  const openDialog = useCallback(() => {
    setDraftOperation(operation);
    setIsDialogOpen(true);
  }, [operation]);

  const headingId = useId();

  return (
    <>
      <ProcessingRectNodeShell
        nodeType={NODE_TYPES.MATH_OPERATION_NODE}
        icon={selected.icon}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConfigClick={openDialog}
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle id={headingId}>Configurar operación matemática</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elige qué operación realizar entre los dos valores de entrada.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {OPERATIONS.map(({ op, label: opLabel, icon }) => {
                const isSelected = draftOperation === op;
                return (
                  <Button
                    key={op}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className="h-auto justify-start px-3 py-2"
                    onClick={() => setDraftOperation(op)}
                  >
                    <span className="mr-2 text-base font-extrabold">{icon}</span>
                    <span className="text-sm font-medium">{opLabel}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraftOperation(operation);
                setIsDialogOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setOperation(draftOperation);
                setIsDialogOpen(false);
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

MathOperationNode.displayName = "MathOperationNode";
