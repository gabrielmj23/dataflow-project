import { memo, useId, useState } from "react";
import type { NodeProps } from "@xyflow/react";

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
};

export const ConstantInputNode = memo(({ data }: NodeProps) => {
  const { label = "Constante" } = (data ?? {}) as ConstantInputNodeData;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [value, setValue] = useState<number>(0);
  const inputId = useId();

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
                onChange={(e) => setValue(Number(e.target.value))}
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
