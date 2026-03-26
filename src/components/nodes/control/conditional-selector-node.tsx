import { memo, useEffect, useMemo } from "react";
import {
  Position,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Input } from "@/components/ui/input";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

export type ConditionalSelectorOption = {
  label?: string;
  token: string;
  value: number;
};

export type ConditionalSelectorNodeData = {
  label?: string;
  runtimeError?: string | null;
  options?: ConditionalSelectorOption[];
  defaultValue?: number;
};

const DEFAULT_OPTIONS: ConditionalSelectorOption[] = [
  { label: "Salida 1", token: "Salida 1", value: 10 },
  { label: "Salida 2", token: "Salida 2", value: 20 },
];

function offsets(count: number): string[] {
  const safe = Math.max(0, Math.floor(count));
  if (safe === 0) return [];
  if (safe === 1) return ["50%"];
  const start = 15;
  const end = 85;
  const step = (end - start) / (safe - 1);
  return Array.from({ length: safe }, (_, i) => `${start + step * i}%`);
}

function sanitizeOptions(value: unknown): ConditionalSelectorOption[] {
  if (!Array.isArray(value)) return DEFAULT_OPTIONS;

  const out: ConditionalSelectorOption[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!item || typeof item !== "object") continue;
    const tokenRaw = (item as { token?: unknown }).token;
    const valueRaw = (item as { value?: unknown }).value;
    const labelRaw = (item as { label?: unknown }).label;

    const token =
      tokenRaw === undefined || tokenRaw === null
        ? `${i + 1}`
        : String(tokenRaw);
    const val = Number.isFinite(Number(valueRaw)) ? Number(valueRaw) : 0;

    out.push({
      label: typeof labelRaw === "string" ? labelRaw : undefined,
      token,
      value: val,
    });
  }

  return out.length > 0 ? out : DEFAULT_OPTIONS;
}

export const ConditionalSelectorNode = memo(
  ({ id, data, selected }: NodeProps) => {
    const { runtimeError, options: rawOptions } = (data ??
      {}) as ConditionalSelectorNodeData;

    const options = sanitizeOptions(rawOptions);
    const pairId = (data as { pairId?: string | null })?.pairId ?? null;

    const { setNodes, setEdges } = useReactFlow();
    const updateNodeInternals = useUpdateNodeInternals();
    const nodes = useStore((state) => state.nodes);
    const edges = useStore((state) => state.edges);

    const pairedConditional = useMemo(() => {
      if (pairId) {
        return nodes.find(
          (n) =>
            n.type === "conditional" &&
            (n.data as { pairId?: string | null })?.pairId === pairId,
        );
      }

      const edge = edges.find(
        (e) => String(e.target) === String(id) && e.targetHandle === "token",
      );
      if (!edge) return null;
      const candidate = nodes.find((n) => String(n.id) === String(edge.source));
      return candidate?.type === "conditional" ? candidate : null;
    }, [edges, id, nodes, pairId]);

    const syncedOptions = useMemo(() => {
      const conditional = pairedConditional;
      if (!conditional) return options;

      const condsRaw =
        conditional?.data &&
        Array.isArray((conditional.data as { conditions?: unknown }).conditions)
          ? ((conditional.data as { conditions?: unknown }).conditions as Array<{
              outputToken?: unknown;
            }>)
          : null;
      if (!condsRaw || condsRaw.length === 0) return options.slice(0, 1);

      return condsRaw.map((cond, idx) => {
        const labelText =
          typeof cond.outputToken === "string" && cond.outputToken.trim()
            ? cond.outputToken.trim()
            : `Salida ${idx + 1}`;
        const existing = options[idx];
        return {
          label: labelText,
          token:
            typeof cond.outputToken === "string" && cond.outputToken.trim()
              ? cond.outputToken.trim()
              : `${idx + 1}`,
          value: typeof existing?.value === "number" ? existing.value : 0,
        } as ConditionalSelectorOption;
      });
    }, [options, pairedConditional]);

    const valueHandleOffsets = useMemo(
      () => offsets(syncedOptions.length),
      [syncedOptions.length],
    );

    const tokenToIndexMap = useMemo(() => {
      const map = new Map<string, number>();
      syncedOptions.forEach((opt, idx) => {
        const token = String(opt.token ?? "").trim();
        if (!token) return;
        if (!map.has(token)) {
          map.set(token, idx + 1);
        }
      });
      return map;
    }, [syncedOptions]);

    useEffect(() => {
      updateNodeInternals(id);
    }, [id, syncedOptions.length, updateNodeInternals]);

    useEffect(() => {
      if (tokenToIndexMap.size === 0) return;

      const hasLegacyHandles = edges.some((edge) => {
        if (String(edge.source) === String(id)) {
          const sourceHandle =
            typeof edge.sourceHandle === "string" ? edge.sourceHandle.trim() : "";
          const idx = sourceHandle ? tokenToIndexMap.get(sourceHandle) : null;
          if (idx && sourceHandle !== `out-${idx}`) return true;
        }

        if (String(edge.target) === String(id)) {
          const targetHandle =
            typeof edge.targetHandle === "string" ? edge.targetHandle.trim() : "";
          const idx = targetHandle ? tokenToIndexMap.get(targetHandle) : null;
          if (idx && targetHandle !== `in-${idx}`) return true;
        }

        return false;
      });

      if (!hasLegacyHandles) return;

      setEdges((prev) => {
        let changed = false;
        const next = prev.map((edge) => {
          let sourceHandle = edge.sourceHandle;
          let targetHandle = edge.targetHandle;

          if (String(edge.source) === String(id)) {
            const sourceToken =
              typeof sourceHandle === "string" ? sourceHandle.trim() : "";
            const idx = sourceToken ? tokenToIndexMap.get(sourceToken) : null;
            if (idx && sourceHandle !== `out-${idx}`) {
              sourceHandle = `out-${idx}`;
              changed = true;
            }
          }

          if (String(edge.target) === String(id)) {
            const targetToken =
              typeof targetHandle === "string" ? targetHandle.trim() : "";
            const idx = targetToken ? tokenToIndexMap.get(targetToken) : null;
            if (idx && targetHandle !== `in-${idx}`) {
              targetHandle = `in-${idx}`;
              changed = true;
            }
          }

          if (
            sourceHandle === edge.sourceHandle &&
            targetHandle === edge.targetHandle
          ) {
            return edge;
          }

          return {
            ...edge,
            sourceHandle,
            targetHandle,
          };
        });

        return changed ? next : prev;
      });
    }, [edges, id, setEdges, tokenToIndexMap]);

    const minHeight = useMemo(() => {
      const base = 80;
      const perOption = 28;

      const maxLabelLen = syncedOptions.reduce((acc, opt) => {
        const text = String(opt.label ?? opt.token ?? "").trim();
        return Math.max(acc, text.length);
      }, 0);

      const extraRows = Math.max(0, Math.ceil((maxLabelLen - 18) / 12));

      return (
        base + Math.max(0, syncedOptions.length - 1) * perOption + extraRows * 12
      );
    }, [syncedOptions]);

    useEffect(() => {
      const isEqual =
        options.length === syncedOptions.length &&
        options.every((opt, idx) => {
          const other = syncedOptions[idx];
          return (
            opt?.label === other?.label &&
            opt?.token === other?.token &&
            opt?.value === other?.value
          );
        });
      if (isEqual) return;

      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  options: syncedOptions,
                },
              }
            : node,
        ),
      );
    }, [id, options, setNodes, syncedOptions]);

    const maskFor = (params: {
      handleType: "source" | "target";
      handleId: string | null | undefined;
    }) =>
      getPortTypeMask({
        nodeType: "conditionalSelector",
        handleType: params.handleType,
        handleId: params.handleId ?? null,
      });

    const typeFor = (params: {
      handleType: "source" | "target";
      handleId: string | null | undefined;
    }) => maskToVisualPortDataType(maskFor(params));

    return (
      <BaseNode
        selected={selected}
        runtimeError={runtimeError}
        className="relative flex w-56 flex-col items-center justify-center rounded-2xl border-lime-700 bg-lime-600 px-5 text-center text-white shadow-md"
        style={{ minHeight: `${minHeight}px` }}
      >
        <CustomTypedHandle
          type="target"
          position={Position.Top}
          id="token"
          dataType={typeFor({ handleType: "target", handleId: "token" })}
          typeMask={maskFor({ handleType: "target", handleId: "token" })}
          className="h-2 w-2"
          indicatorClassName="border-lime-700"
        />

        {runtimeError ? (
          <div className="absolute top-3 text-[11px] text-red-200">
            {runtimeError}
          </div>
        ) : null}

        {syncedOptions.map((_, idx) => {
          const targetHandleId = `in-${idx + 1}`;
          return (
            <CustomTypedHandle
              key={`handle-${targetHandleId}`}
              type="target"
              position={Position.Left}
              id={targetHandleId}
              style={{ top: valueHandleOffsets[idx] ?? "50%" }}
              dataType={typeFor({ handleType: "target", handleId: targetHandleId })}
              typeMask={maskFor({ handleType: "target", handleId: targetHandleId })}
              className="absolute -left-1 h-2 w-2 -translate-y-1/2"
              indicatorClassName="border-lime-700"
            />
          );
        })}

        {syncedOptions.map((opt, idx) => {
          const label = opt.label ?? String(opt.token);
          const trimmed = String(label ?? "").trim();
          const len = Math.max(0, trimmed.length);
          const widthPx = len <= 1 ? 36 : Math.min(120, 12 + len * 8);

          return (
            <Input
              key={`label-${idx}`}
              value={label}
              readOnly
              tabIndex={-1}
              className="nodrag absolute h-6 -translate-y-1/2 border-transparent bg-transparent px-1 text-center text-[10px] text-white placeholder:text-white/60 focus:border-white/50 focus:bg-white/10 focus:outline-none pointer-events-none"
              style={{
                top: `calc(${valueHandleOffsets[idx] ?? "50%"} + 9px)`,
                left: "50%",
                width: `${widthPx}px`,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}

        {syncedOptions.map((_, idx) => {
          const sourceHandleId = `out-${idx + 1}`;
          return (
            <CustomTypedHandle
              key={sourceHandleId}
              type="source"
              position={Position.Right}
              id={sourceHandleId}
              style={{ top: valueHandleOffsets[idx] ?? "50%" }}
              dataType={typeFor({ handleType: "source", handleId: sourceHandleId })}
              typeMask={maskFor({ handleType: "source", handleId: sourceHandleId })}
              className="absolute -right-1 h-2 w-2 -translate-y-1/2"
              indicatorClassName="border-lime-700"
            />
          );
        })}
      </BaseNode>
    );
  },
);

ConditionalSelectorNode.displayName = "ConditionalSelectorNode";
