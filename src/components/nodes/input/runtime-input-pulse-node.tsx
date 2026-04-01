import { memo, useCallback, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Keyboard } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export type RuntimeInputPulseNodeData = {
  identifier?: string;
  valueType?: "number" | "text";
  prompt?: string;
  defaultValue?: number | string;
};

export const RuntimeInputPulseNode = memo(({ id, data }: NodeProps) => {
  const { identifier, valueType, prompt, defaultValue } = (data ??
    {}) as RuntimeInputPulseNodeData;

  const resolvedValueType = valueType === "text" ? "text" : "number";
  const promptText = typeof prompt === "string" ? prompt : "Ingrese su entrada";
  const numericDefault = typeof defaultValue === "number" ? defaultValue : 0;
  const textDefault = typeof defaultValue === "string" ? defaultValue : "";
  const identifierValue = typeof identifier === "string" ? identifier : "";
  const label = identifierValue.trim() || "Leer pulsos";

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const identifierId = useId();
  const promptId = useId();
  const defaultId = useId();

  const setData = useCallback(
    (patch: Partial<RuntimeInputPulseNodeData>) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  ...patch,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <>
      <IterationRectNodeShell
        nodeType="runtimeInputPulse"
        icon={<Keyboard className="h-4 w-4" />}
        label={label}
        variant="doubleInSingleOut"
        className="relative flex h-18 w-36 flex-col justify-center rounded-2xl border-emerald-600 bg-emerald-500 px-6 text-center text-white shadow-md"
        indicatorClassName="border-emerald-600"
        onConfigClick={() => setIsDialogOpen(true)}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar entrada en pulsos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={identifierId}
              >
                Identificador (se muestra en el nodo):
              </label>
              <Input
                id={identifierId}
                value={identifierValue}
                onChange={(e) => setData({ identifier: e.currentTarget.value })}
                placeholder="Ej: Leer pulsos"
              />
            </div>

            <div>
              <div className="mb-2 block text-sm font-medium text-gray-900">
                Tipo de valor:
              </div>
              <Tabs
                value={resolvedValueType}
                onValueChange={(next) => {
                  if (next !== "number" && next !== "text") return;
                  setData({
                    valueType: next,
                    defaultValue: next === "text" ? "" : 0,
                  });
                }}
              >
                <TabsList>
                  <TabsTrigger value="number">Número</TabsTrigger>
                  <TabsTrigger value="text">Texto</TabsTrigger>
                </TabsList>
                <TabsContent value="number" />
                <TabsContent value="text" />
              </Tabs>
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={promptId}
              >
                Mensaje a mostrar:
              </label>
              <Input
                id={promptId}
                value={promptText}
                onChange={(e) => setData({ prompt: e.currentTarget.value })}
                placeholder="Ej: Ingrese su nombre"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-gray-900"
                htmlFor={defaultId}
              >
                Valor por defecto:
              </label>
              {resolvedValueType === "text" ? (
                <Input
                  id={defaultId}
                  type="text"
                  value={textDefault}
                  onChange={(e) =>
                    setData({ defaultValue: e.currentTarget.value })
                  }
                />
              ) : (
                <Input
                  id={defaultId}
                  type="number"
                  value={numericDefault}
                  onChange={(e) => {
                    const next = e.currentTarget.valueAsNumber;
                    setData({ defaultValue: Number.isFinite(next) ? next : 0 });
                  }}
                />
              )}
            </div>
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

RuntimeInputPulseNode.displayName = "RuntimeInputPulseNode";
