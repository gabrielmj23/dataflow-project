import { memo, useEffect, useMemo } from "react";
import {
  Position,
  useReactFlow,
  useStore,
  type NodeProps,
} from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Input } from "@/components/ui/input";
import {
  getPortTypeMask,
  maskToVisualPortDataType,
} from "@/flow/port-data-type";

export type SelectorOption = {
  label?: string;
  token: string;
  value: number;
};

export type SelectorNodeData = {
  label?: string;
  runtimeError?: string | null;
  options?: SelectorOption[];
  defaultValue?: number;
};

const DEFAULT_OPTIONS: SelectorOption[] = [
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

function sanitizeOptions(value: unknown): SelectorOption[] {
  if (!Array.isArray(value)) return DEFAULT_OPTIONS;

  const out: SelectorOption[] = [];
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

export const SelectorNode = memo(({ id, data }: NodeProps) => {
  const { runtimeError, options: rawOptions } = (data ??
    {}) as SelectorNodeData;

  const options = sanitizeOptions(rawOptions);
  const pairId = (data as { pairId?: string | null })?.pairId ?? null;

  const { setNodes } = useReactFlow();
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
      } as SelectorOption;
    });
  }, [options, pairedConditional]);

  const valueHandleOffsets = useMemo(
    () => offsets(syncedOptions.length),
    [syncedOptions.length],
  );

  const minHeight = useMemo(() => {
    const base = 80; // compact base height
    const perOption = 28; // extra height per option beyond the first

    const maxLabelLen = syncedOptions.reduce((acc, opt) => {
      const text = String(opt.label ?? opt.token ?? "").trim();
      return Math.max(acc, text.length);
    }, 0);

    // If labels are long, add extra rows to increase height gradually.
    const extraRows = Math.max(0, Math.ceil((maxLabelLen - 18) / 12));

    return (
      base + Math.max(0, syncedOptions.length - 1) * perOption + extraRows * 12
    );
  }, [syncedOptions]);

  // Persist synced options into node data when they change.
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
      nodeType: "selector",
      handleType: params.handleType,
      handleId: params.handleId ?? null,
    });

  const typeFor = (params: {
    handleType: "source" | "target";
    handleId: string | null | undefined;
  }) => maskToVisualPortDataType(maskFor(params));

  return (
    <BaseNode
      runtimeError={runtimeError}
      className="relative flex w-56 flex-col items-center justify-center rounded-2xl border-orange-600 bg-orange-500 px-5 text-center text-white shadow-md"
      style={{ minHeight: `${minHeight}px` }}
    >
      <CustomTypedHandle
        type="target"
        position={Position.Top}
        id="token"
        dataType={typeFor({ handleType: "target", handleId: "token" })}
        typeMask={maskFor({ handleType: "target", handleId: "token" })}
        className="h-2 w-2"
        indicatorClassName="border-orange-600"
      />

      {/* Removed icon and node title per design. Show runtime error if present. */}
      {runtimeError ? (
        <div className="absolute top-3 text-[11px] text-red-200">
          {runtimeError}
        </div>
      ) : null}

      {/* Handles anchored to the node edge (use token string as handle id) */}
      {syncedOptions.map((opt, idx) => {
        const tokenId = String(opt.token ?? `${idx + 1}`);
        return (
          <CustomTypedHandle
            key={`handle-${tokenId}-${idx}`}
            type="target"
            position={Position.Left}
            id={tokenId}
            style={{ top: valueHandleOffsets[idx] ?? "50%" }}
            dataType={typeFor({ handleType: "target", handleId: tokenId })}
            typeMask={maskFor({ handleType: "target", handleId: tokenId })}
            className="absolute -left-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
        );
      })}

      {/* Labels aligned with handles (absolute, same offsets) */}
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

      {/* One source handle per option so outputs can take different paths. */}
      {syncedOptions.map((opt, idx) => {
        const tokenId = String(opt.token ?? `${idx + 1}`);
        return (
          <CustomTypedHandle
            key={`out-${tokenId}-${idx}`}
            type="source"
            position={Position.Right}
            id={tokenId}
            style={{ top: valueHandleOffsets[idx] ?? "50%" }}
            dataType={typeFor({ handleType: "source", handleId: tokenId })}
            typeMask={maskFor({ handleType: "source", handleId: tokenId })}
            className="absolute -right-1 h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-orange-600"
          />
        );
      })}
    </BaseNode>
  );
});

SelectorNode.displayName = "SelectorNode";
