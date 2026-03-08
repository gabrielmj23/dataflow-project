import { memo, useEffect, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ConstantTextInputNodeData = {
  label?: string;
  value?: string;
};

export const ConstantTextInputNode = memo(({ id, data }: NodeProps) => {
  const { value } = (data ?? {}) as ConstantTextInputNodeData;

  const textValue = typeof value === "string" ? value : "texto";

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineValue, setInlineValue] = useState(textValue);
  const inputId = useId();

  useEffect(() => {
    if (isInlineEditing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInlineValue(textValue);
  }, [isInlineEditing, textValue]);

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
          : node,
      ),
    );
  };

  const startInlineEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setInlineValue(textValue);
    setIsInlineEditing(true);
  };

  const commitInlineEdit = () => {
    setValue(inlineValue);
    setIsInlineEditing(false);
  };

  const cancelInlineEdit = () => {
    setInlineValue(textValue);
    setIsInlineEditing(false);
  };

  return (
    <>
      <InputCircleNodeShell
        nodeType="constantText"
        icon={
          isInlineEditing ? (
            <Input
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.currentTarget.value)}
              onBlur={commitInlineEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitInlineEdit();
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelInlineEdit();
                }
              }}
              className="nodrag nopan h-6 w-12 border-white/60 bg-white/10 px-1 text-center text-xs text-white placeholder:text-white/60"
            />
          ) : (
            <button
              type="button"
              onClick={startInlineEdit}
              className="nodrag nopan max-w-12 truncate text-sm font-normal outline-none"
              title="Editar valor"
            >
              {textValue || ""}
            </button>
          )
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setIsDialogOpen(false);
                }
              }}
              placeholder="Escribe un texto"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <div className="flex justify-end">
              <Button onClick={() => setIsDialogOpen(false)}>Guardar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

ConstantTextInputNode.displayName = "ConstantTextInputNode";
