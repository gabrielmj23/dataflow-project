import { memo, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import { Check, X } from "lucide-react";

export type ConstantBooleanInputNodeData = {
  label?: string;
  value?: boolean;
};

export const ConstantBooleanInputNode = memo(({ id, data }: NodeProps) => {
  const { value } = (data ?? {}) as ConstantBooleanInputNodeData;

  const boolValue = value !== false;

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const setValue = (nextValue: boolean) => {
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
        nodeType="constantBoolean"
        icon={
          <div className="flex flex-col items-center justify-center gap-0.5">
            <span className="flex items-center justify-center">
              {boolValue ? (
                <Check className="h-5 w-5" />
              ) : (
                <X className="h-5 w-5" />
              )}
            </span>
            <span className="text-sm font-semibold leading-tight">
              {boolValue ? "Verdadero" : "Falso"}
            </span>
          </div>
        }
        label=""
        onConfigClick={() => setIsDialogOpen(true)}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar constante lógica</DialogTitle>
          </DialogHeader>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900">
              Valor de la constante:
            </label>
            <div className="mt-1 flex justify-center">
              <Toggle
                className="hover:cursor-pointer data-[state=on]:bg-green-600 data-[state=off]:bg-red-500 text-white data-[state=on]:text-white hover:text-neutral-100"
                pressed={boolValue}
                onPressedChange={(next) => {
                  setValue(!!next);
                }}
              >
                {boolValue ? <Check /> : <X />}
                {boolValue ? "Verdadero" : "Falso"}
              </Toggle>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

ConstantBooleanInputNode.displayName = "ConstantBooleanInputNode";
