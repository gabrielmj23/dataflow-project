import {
  memo,
  useCallback,
  useId,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { useReactFlow, type NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type SortOrder = "asc" | "desc";

type SortListNodeData = {
  label?: string;
  order?: SortOrder;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

const ORDER_OPTIONS: Array<{
  value: SortOrder;
  label: string;
  icon: ReactElement;
}> = [
  {
    value: "asc",
    label: "De Menor a Mayor",
    icon: <ArrowUpAZ className="h-5 w-5" />,
  },
  {
    value: "desc",
    label: "De Mayor a Menor",
    icon: <ArrowDownAZ className="h-5 w-5" />,
  },
];

export const SortListNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Ordenar lista",
    order: rawOrder,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as SortListNodeData;

  const order = useMemo<SortOrder>(() => {
    if (rawOrder === "asc" || rawOrder === "desc") return rawOrder;
    return "asc";
  }, [rawOrder]);

  const { setNodes } = useReactFlow();
  const setOrder = useCallback(
    (next: SortOrder) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  order: next,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState<SortOrder>(order);

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar ejecucion",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const openDialog = useCallback(() => {
    setDraftOrder(order);
    setIsDialogOpen(true);
  }, [order]);

  const headingId = useId();

  const activeIcon =
    order === "asc" ? (
      <ArrowUpAZ className="h-4 w-4" />
    ) : (
      <ArrowDownAZ className="h-4 w-4" />
    );

  return (
    <>
      <IterationRectNodeShell
        nodeType="sortList"
        icon={activeIcon}
        label={label}
        subtitle={config.subtitle}
        variant="singleInSingleOut"
        onConfigClick={openDialog}
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle id={headingId}>Configurar orden</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elige cómo ordenar la lista.
            </p>

            <div className="grid grid-cols-1 gap-2">
              {ORDER_OPTIONS.map((option) => {
                const isSelected = draftOrder === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className="h-auto justify-start gap-2 px-3 py-2"
                    onClick={() => setDraftOrder(option.value)}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/60 text-foreground">
                      {option.icon}
                    </span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraftOrder(order);
                  setIsDialogOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOrder(draftOrder);
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

SortListNode.displayName = "SortListNode";
