import { memo, useCallback, useId, useState } from "react";
import { Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Shuffle } from "lucide-react";

import { BaseNode, BaseNodeHeader } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import NodeSettingsButton from "@/components/ui/node-settings-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

export type SelectorOption = {
  label?: string;
  token: number;
  value: number;
};

export type SelectorNodeData = {
  label?: string;
  runtimeError?: string | null;
  options?: SelectorOption[];
  defaultValue?: number;
};

const DEFAULT_OPTIONS: SelectorOption[] = [
  { label: "Token 1", token: 1, value: 10 },
  { label: "Token 2", token: 2, value: 20 },
];

function sanitizeOptions(value: unknown): SelectorOption[] {
  if (!Array.isArray(value)) return DEFAULT_OPTIONS;

  const out: SelectorOption[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!item || typeof item !== "object") continue;
    const tokenRaw = (item as { token?: unknown }).token;
    const valueRaw = (item as { value?: unknown }).value;
    const labelRaw = (item as { label?: unknown }).label;

    const token = Number.isFinite(Number(tokenRaw))
      ? Math.floor(Number(tokenRaw))
      : i + 1;
    const val = Number.isFinite(Number(valueRaw))
      ? Number(valueRaw)
      : 0;

    out.push({
      label: typeof labelRaw === "string" ? labelRaw : undefined,
      token,
      value: val,
    });
  }

  return out.length > 0 ? out : DEFAULT_OPTIONS;
}

export const SelectorNode = memo(({ id, data }: NodeProps) => {
  const { label = "Selector", runtimeError, options: rawOptions, defaultValue } =
    (data ?? {}) as SelectorNodeData;

  const options = sanitizeOptions(rawOptions);

  const { setNodes } = useReactFlow();
  const setNodeData = useCallback(
    (next: { options: SelectorOption[]; defaultValue?: number }) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  options: next.options,
                  defaultValue: next.defaultValue,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftOptions, setDraftOptions] = useState<SelectorOption[]>(options);
  const [draftDefaultValue, setDraftDefaultValue] = useState<number | undefined>(
    typeof defaultValue === "number" ? defaultValue : undefined,
  );

  const openDialog = useCallback(() => {
    setDraftOptions(options);
    setDraftDefaultValue(
      typeof defaultValue === "number" ? defaultValue : undefined,
    );
    setIsDialogOpen(true);
  }, [defaultValue, options]);

  const saveDialog = useCallback(() => {
    setNodeData({
      options: sanitizeOptions(draftOptions),
      defaultValue: draftDefaultValue,
    });
    setIsDialogOpen(false);
  }, [draftDefaultValue, draftOptions, setNodeData]);

  const titleId = useId();

  const maskFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) =>
    getPortTypeMask({
      nodeType: "selector",
      handleType: params.handleType,
      handleId: params.handleId ?? null,
    });

  const typeFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) => maskToVisualPortDataType(maskFor(params));

  return (
    <>
      <BaseNode
        runtimeError={runtimeError}
        className="relative flex h-20 w-64 flex-col items-center justify-center rounded-2xl border-orange-600 bg-orange-500 px-5 text-center text-white shadow-md"
      >
        <BaseNodeHeader className="absolute top-1 right-1">
          <NodeSettingsButton onClick={openDialog} />
        </BaseNodeHeader>

        <div className="flex flex-col items-center gap-0.5">
          <div className="text-xl font-bold leading-none">
            <Shuffle className="h-5 w-5" />
          </div>
          <div className="text-sm leading-tight">{label}</div>
        </div>

        <div className="mt-1 w-full text-left text-[11px] text-white/85">
          {options.slice(0, 4).map((opt, idx) => (
            <div key={`opt-${idx}`} className="flex items-center justify-between">
              <span>{opt.label ?? `Token ${opt.token}`}</span>
              <span className="font-semibold">{opt.value}</span>
            </div>
          ))}
          {options.length > 4 && (
            <div className="text-[10px] text-white/70">
              +{options.length - 4} más
            </div>
          )}
        </div>

        <CustomTypedHandle
          type="target"
          position={Position.Top}
          id="token"
          dataType={typeFor({ handleType: "target", handleId: "token" })}
          typeMask={maskFor({ handleType: "target", handleId: "token" })}
          className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2"
          indicatorClassName="border-orange-600"
        />
        <CustomTypedHandle
          type="source"
          position={Position.Right}
          id="out"
          dataType={typeFor({ handleType: "source", handleId: "out" })}
          typeMask={maskFor({ handleType: "source", handleId: "out" })}
          className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2"
          indicatorClassName="border-orange-600"
        />
      </BaseNode>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle id={titleId}>Configurar Selector</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Valores por token</div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setDraftOptions((prev) => [
                    ...prev,
                    {
                      label: `Token ${prev.length + 1}`,
                      token: prev.length + 1,
                      value: 0,
                    },
                  ])
                }
              >
                Agregar token
              </Button>
            </div>

            <div className="space-y-2">
              {draftOptions.map((opt, idx) => (
                <div
                  key={`opt-${idx}`}
                  className="grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-4"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-900">
                      Etiqueta
                    </label>
                    <Input
                      value={opt.label ?? ""}
                      placeholder={`Token ${idx + 1}`}
                      onChange={(e) => {
                        const next = e.currentTarget.value;
                        setDraftOptions((prev) =>
                          prev.map((o, i) =>
                            i === idx
                              ? { ...o, label: next.trim() ? next : undefined }
                              : o,
                          ),
                        );
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-900">
                      Token
                    </label>
                    <Input
                      type="number"
                      value={String(opt.token)}
                      onChange={(e) => {
                        const next = Number(e.currentTarget.value);
                        setDraftOptions((prev) =>
                          prev.map((o, i) =>
                            i === idx
                              ? {
                                  ...o,
                                  token: Number.isFinite(next)
                                    ? Math.floor(next)
                                    : o.token,
                                }
                              : o,
                          ),
                        );
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-900">
                      Valor
                    </label>
                    <Input
                      type="number"
                      value={String(opt.value)}
                      onChange={(e) => {
                        const next = Number(e.currentTarget.value);
                        setDraftOptions((prev) =>
                          prev.map((o, i) =>
                            i === idx
                              ? {
                                  ...o,
                                  value: Number.isFinite(next) ? next : o.value,
                                }
                              : o,
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setDraftOptions((prev) =>
                          prev.length <= 1
                            ? prev
                            : prev.filter((_, i) => i !== idx),
                        )
                      }
                      disabled={draftOptions.length <= 1}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Valor por defecto (si no hay coincidencia)
              </label>
              <Input
                type="number"
                value={
                  typeof draftDefaultValue === "number"
                    ? String(draftDefaultValue)
                    : ""
                }
                placeholder="(opcional)"
                onChange={(e) => {
                  const next = Number(e.currentTarget.value);
                  setDraftDefaultValue(
                    Number.isFinite(next) ? next : undefined,
                  );
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={saveDialog}>
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

SelectorNode.displayName = "SelectorNode";
