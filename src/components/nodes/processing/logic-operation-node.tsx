import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useReactFlow,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { Ampersand } from "lucide-react";
import { NODE_TYPES } from "@/common/constants";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogicRectNodeShell } from "../logic/logic-rect-node-shell";

type LogicOperationKind =
  | typeof NODE_TYPES.AND_NODE
  | typeof NODE_TYPES.NAND_NODE
  | typeof NODE_TYPES.OR_NODE
  | typeof NODE_TYPES.NOR_NODE
  | typeof NODE_TYPES.XOR_NODE
  | typeof NODE_TYPES.NOT_NODE;

type LogicOperationOption = {
  op: LogicOperationKind;
  label: string;
  icon: ReactNode;
};

const OPERATIONS: LogicOperationOption[] = [
  {
    op: NODE_TYPES.AND_NODE,
    label: "AND",
    icon: <Ampersand className="h-7 w-7" />,
  },
  {
    op: NODE_TYPES.NAND_NODE,
    label: "NAND",
    icon: <span className="text-xl font-medium leading-none">⊼</span>,
  },
  {
    op: NODE_TYPES.OR_NODE,
    label: "OR",
    icon: <span className="text-xl font-medium leading-none">∨</span>,
  },
  {
    op: NODE_TYPES.NOR_NODE,
    label: "NOR",
    icon: <span className="text-xl font-medium leading-none">⊽</span>,
  },
  {
    op: NODE_TYPES.XOR_NODE,
    label: "XOR",
    icon: <span className="text-xl font-medium leading-none">⊕</span>,
  },
  {
    op: NODE_TYPES.NOT_NODE,
    label: "NOT",
    icon: <span className="text-xl font-medium leading-none">¬</span>,
  },
];

function isLogicOperation(value: unknown): value is LogicOperationKind {
  return (
    value === NODE_TYPES.AND_NODE ||
    value === NODE_TYPES.NAND_NODE ||
    value === NODE_TYPES.OR_NODE ||
    value === NODE_TYPES.NOR_NODE ||
    value === NODE_TYPES.XOR_NODE ||
    value === NODE_TYPES.NOT_NODE
  );
}

export type LogicOperationNodeData = {
  label?: string;
  operation?: LogicOperationKind;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const LogicOperationNode = memo(({ id, data }: NodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();

  const {
    label = "Operación Lógica",
    operation: rawOperation,
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as LogicOperationNodeData;

  const operation = useMemo<LogicOperationKind>(
    () => (isLogicOperation(rawOperation) ? rawOperation : NODE_TYPES.AND_NODE),
    [rawOperation],
  );

  const shellNodeType = operation;

  const shellVariant =
    operation === NODE_TYPES.NOT_NODE ? "singleInSingleOut" : "default";

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, operation, shellVariant, updateNodeInternals]);

  const selected =
    OPERATIONS.find((entry) => entry.op === operation) ?? OPERATIONS[0];

  const { setNodes, setEdges } = useReactFlow();
  const setOperation = useCallback(
    (nextOperation: LogicOperationKind) => {
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

      setEdges((prev) => {
        if (nextOperation === NODE_TYPES.NOT_NODE) {
          return prev.filter((edge) => edge.target !== id);
        }

        return prev.map((edge) => {
          if (edge.target !== id) return edge;
          if (edge.targetHandle === "in") {
            return { ...edge, targetHandle: "in-1" };
          }
          return edge;
        });
      });
    },
    [id, setEdges, setNodes],
  );

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Operación Lógica",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftOperation, setDraftOperation] =
    useState<LogicOperationKind>(operation);

  const openDialog = useCallback(() => {
    setDraftOperation(operation);
    setIsDialogOpen(true);
  }, [operation]);

  const headingId = useId();

  return (
    <>
      <LogicRectNodeShell
        nodeType={shellNodeType}
        icon={selected.icon}
        label={label}
        subtitle={config.subtitle}
        variant={shellVariant}
        runtimeError={runtimeError}
        onConfigClick={openDialog}
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle id={headingId}>
              Configurar operación lógica
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elige qué operación lógica realizar.
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
                    <span className="mr-2 text-base font-extrabold">
                      {icon}
                    </span>
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

LogicOperationNode.displayName = "LogicOperationNode";
