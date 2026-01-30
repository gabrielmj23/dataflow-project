import { memo, useCallback, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

export type ConstantNumberInputNodeData = {
  label?: string;
  value?: number;
};

export const ConstantNumberInputNode = memo(({ id, data }: NodeProps) => {
  const { value } = (data ?? {}) as ConstantNumberInputNodeData;

  const numericValue = typeof value === "number" ? value : 0;

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const inputId = useId();

  const setValue = useCallback(
    (nextValue: number) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  value: nextValue,
                },
              }
            : node
        )
      );
    },
    [id, setNodes]
  );

  return (
    <>
      <InputCircleNodeShell
        nodeType="constantNumber"
        icon={<span className="text-sm font-normal">{numericValue}</span>}
        label=""
        onConfigClick={() => setIsDialogOpen(true)}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar constante numérica</DialogTitle>
          </DialogHeader>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-900"
              htmlFor={inputId}
            >
              Valor de la constante:
            </label>
            <div className="flex">
              <Button
                className="rounded-r-none"
                onClick={() => setValue(numericValue - 1)}
              >
                <Minus />
              </Button>
              <Input
                type="number"
                id={inputId}
                value={numericValue}
                onChange={(e) => {
                  const next = e.currentTarget.valueAsNumber;
                  setValue(Number.isFinite(next) ? next : 0);
                }}
                className="rounded-none"
                step={0.01}
              />
              <Button
                className="rounded-l-none"
                onClick={() => setValue(numericValue + 1)}
              >
                <Plus />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

ConstantNumberInputNode.displayName = "ConstantNumberInputNode";
