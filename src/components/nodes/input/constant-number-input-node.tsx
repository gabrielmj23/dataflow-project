import { memo, useCallback, useEffect, useId, useState } from "react";
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
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineValue, setInlineValue] = useState(String(numericValue));
  const inputId = useId();

  useEffect(() => {
    if (isInlineEditing) return;
    setInlineValue(String(numericValue));
  }, [isInlineEditing, numericValue]);

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
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const startInlineEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setInlineValue(String(numericValue));
    setIsInlineEditing(true);
  };

  const commitInlineEdit = () => {
    const parsed = Number(inlineValue);
    if (Number.isFinite(parsed)) {
      setValue(parsed);
    }
    setIsInlineEditing(false);
  };

  const cancelInlineEdit = () => {
    setInlineValue(String(numericValue));
    setIsInlineEditing(false);
  };

  return (
    <>
      <InputCircleNodeShell
        nodeType="constantNumber"
        icon={
          isInlineEditing ? (
            <Input
              autoFocus
              type="number"
              step={0.01}
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
              className="nodrag nopan h-6 w-12 border-white/60 bg-white/10 px-1 text-center text-xs text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <button
              type="button"
              onClick={startInlineEdit}
              className="nodrag nopan max-w-[3rem] truncate text-sm font-normal outline-none"
              title="Editar valor"
            >
              {numericValue}
            </button>
          )
        }
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsDialogOpen(false);
                  }
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
