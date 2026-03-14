import { memo, useCallback, useEffect, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Keyboard } from "lucide-react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
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

export type RuntimeInputNodeData = {
  identifier?: string;
  valueType?: "number" | "text";
  prompt?: string;
  defaultValue?: number | string;
};

export const RuntimeInputNode = memo(({ id, data }: NodeProps) => {
  const { identifier, valueType, prompt, defaultValue } = (data ??
    {}) as RuntimeInputNodeData;

  const resolvedValueType = valueType === "text" ? "text" : "number";

  const promptText = typeof prompt === "string" ? prompt : "Ingrese su entrada";
  const numericDefault = typeof defaultValue === "number" ? defaultValue : 0;
  const textDefault = typeof defaultValue === "string" ? defaultValue : "";
  const identifierValue = typeof identifier === "string" ? identifier : "";
  const identifierLabel = identifierValue.trim()
    ? identifierValue.trim()
    : "Leer";
  const identifierLabelDisplay = (() => {
    const MAX = 10;
    return identifierLabel.length > MAX
      ? `${identifierLabel.slice(0, MAX)}...`
      : identifierLabel;
  })();

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineIdentifier, setInlineIdentifier] = useState(identifierValue);

  const identifierId = useId();
  const promptId = useId();
  const defaultId = useId();

  const setData = useCallback(
    (patch: Partial<RuntimeInputNodeData>) => {
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

  useEffect(() => {
    if (isInlineEditing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInlineIdentifier(identifierValue);
  }, [identifierValue, isInlineEditing]);

  const startInlineEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setInlineIdentifier(identifierValue);
    setIsInlineEditing(true);
  };

  const commitInlineEdit = () => {
    setData({ identifier: inlineIdentifier });
    setIsInlineEditing(false);
  };

  const cancelInlineEdit = () => {
    setInlineIdentifier(identifierValue);
    setIsInlineEditing(false);
  };

  return (
    <>
      <InputCircleNodeShell
        nodeType="runtimeInput"
        icon={<Keyboard className="h-4 w-4" />}
        label={
          isInlineEditing ? (
            <Input
              autoFocus
              type="text"
              value={inlineIdentifier}
              onChange={(e) => setInlineIdentifier(e.currentTarget.value)}
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
              className="nodrag nopan h-6 w-12 border-white/60 bg-white/10 px-1 text-center text-xs text-white"
            />
          ) : (
            <button
              type="button"
              onClick={startInlineEdit}
              className="nodrag nopan max-w-12 truncate text-[9px] leading-tight text-white outline-none hover:cursor-pointer"
              title="Editar identificador"
            >
              {identifierLabelDisplay}
            </button>
          )
        }
        labelClassName="text-[9px]"
        sublabel={null}
        onConfigClick={() => setIsDialogOpen(true)}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar entrada</DialogTitle>
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
                onChange={(e) => {
                  const next = e.currentTarget.value;
                  setData({ identifier: next });
                }}
                placeholder="Ej: Nombre"
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
                Valor por defecto (si se cancela o no hay UI):
              </label>
              {resolvedValueType === "text" ? (
                <Input
                  id={defaultId}
                  type="text"
                  value={textDefault}
                  onChange={(e) => {
                    setData({ defaultValue: e.currentTarget.value });
                  }}
                  placeholder="(opcional)"
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

RuntimeInputNode.displayName = "RuntimeInputNode";
