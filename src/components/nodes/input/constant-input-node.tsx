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

export type ConstantInputNodeData = {
  label?: string;
  value?: number;
};

export const ConstantInputNode = memo(({ id, data }: NodeProps) => {
  const { label = "Constante", value: rawValue } = (data ??
    {}) as ConstantInputNodeData;

  const value = Number.isFinite(rawValue) ? (rawValue as number) : 0;

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
        icon={<span className="text-lg font-bold">{value}</span>}
        label={label}
        onConfigClick={() => setIsDialogOpen(true)}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar nodo</DialogTitle>
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
                onClick={() => setValue(value - 1)}
              >
                <Minus />
              </Button>
              <Input
                type="number"
                id={inputId}
                value={value}
                onChange={(e) => {
                  const next = e.currentTarget.valueAsNumber;
                  setValue(Number.isFinite(next) ? next : 0);
                }}
                className="rounded-none"
                step={0.01}
              />
              <Button
                className="rounded-l-none"
                onClick={() => setValue(value + 1)}
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

ConstantInputNode.displayName = "ConstantInputNode";
