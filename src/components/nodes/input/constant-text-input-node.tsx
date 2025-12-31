import { memo, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type ConstantTextInputNodeData = {
  label?: string;
  value?: string;
};

export const ConstantTextInputNode = memo(({ id, data }: NodeProps) => {
  const { value } = (data ?? {}) as ConstantTextInputNodeData;

  const textValue = typeof value === "string" ? value : "texto";

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const inputId = useId();

  const setValue = (nextValue: string) => {
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
  };

  return (
    <>
      <InputCircleNodeShell
        icon={
          <span className="text-sm font-semibold truncate max-w-[3rem]">
            {textValue || "txt"}
          </span>
        }
        label=""
        onConfigClick={() => setIsDialogOpen(true)}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar constante de texto</DialogTitle>
          </DialogHeader>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-900"
              htmlFor={inputId}
            >
              Valor de la constante:
            </label>
            <Input
              type="text"
              id={inputId}
              value={textValue}
              onChange={(e) => setValue(e.currentTarget.value)}
              placeholder="Escribe un texto"
              className="mt-1"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

ConstantTextInputNode.displayName = "ConstantTextInputNode";
