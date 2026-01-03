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
import { Check, Minus, Plus, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";

export type ConstantInputNodeData = {
  label?: string;
  value?: number | boolean | string;
};

export const ConstantInputNode = memo(({ id, data }: NodeProps) => {
  const { label = "Constante", value: rawValue } = (data ??
    {}) as ConstantInputNodeData;

  const value = rawValue;
  const numericValue = typeof rawValue === "number" ? rawValue : 0;

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
        nodeType="constantInput"
        icon={
          <span className="text-lg font-bold">
            {typeof value === "boolean" ? (value ? "V" : "F") : value}
          </span>
        }
        label={label}
        onConfigClick={() => setIsDialogOpen(true)}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar nodo</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="number">
            <TabsList>
              <TabsTrigger value="number">Número</TabsTrigger>
              <TabsTrigger value="boolean">Lógico</TabsTrigger>
              <TabsTrigger value="string">Texto</TabsTrigger>
            </TabsList>
            <TabsContent value="number">
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
            </TabsContent>
            <TabsContent value="boolean">
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-gray-900"
                  htmlFor={inputId}
                >
                  Valor de la constante:
                </label>
                <div className="mt-1 flex justify-center">
                  <Toggle
                    className="hover:cursor-pointer data-[state=on]:bg-green-600 data-[state=off]:bg-red-500 text-white data-[state=on]:text-white hover:text-neutral-100"
                    pressed={rawValue === true}
                    onPressedChange={(next) => {
                      const nextValue = !!next;
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
                    }}
                  >
                    {rawValue === true ? <Check /> : <X />}
                    {rawValue === true ? "Verdadero" : "Falso"}
                  </Toggle>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="string">
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
                  value={typeof rawValue === "string" ? rawValue : ""}
                  onChange={(e) => {
                    const nextValue = e.currentTarget.value;
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
                  }}
                  placeholder="Escribe un texto"
                  className="mt-1"
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
});

ConstantInputNode.displayName = "ConstantInputNode";
