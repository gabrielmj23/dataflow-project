import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReactFlow, useStore, type NodeProps } from "@xyflow/react";
import { Minus, Plus, Timer } from "lucide-react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TimerInputNodeData = {
  label?: string;
  timeValue?: number;
};

export const TimerInputNode = memo(({ id, data }: NodeProps) => {
  const { label = "Timer", timeValue: rawTimeValue } = (data ??
    {}) as TimerInputNodeData;

  const timeValue = Number.isFinite(rawTimeValue)
    ? (rawTimeValue as number)
    : 0;

  const { setNodes } = useReactFlow();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const inputId = useId();

  const runtimeClassName = useStore((state) => {
    const nodeLookup = (state as unknown as { nodeLookup?: unknown })
      .nodeLookup;
    const lookup =
      nodeLookup &&
      typeof nodeLookup === "object" &&
      "get" in (nodeLookup as Record<string, unknown>) &&
      typeof (nodeLookup as { get?: unknown }).get === "function"
        ? (nodeLookup as { get: (nodeId: string) => unknown })
        : null;

    const entry = lookup ? lookup.get(String(id)) : null;
    if (!entry || typeof entry !== "object") return "";
    const className = (entry as { className?: unknown }).className;
    return typeof className === "string" ? className : "";
  });

  const isRunning = runtimeClassName.includes("rf-node-running");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      startedAtRef.current = null;
      return;
    }

    // Start a local countdown when the engine marks this node as running.
    const totalMs = Math.max(0, timeValue * 1000);
    const startedAt = Date.now();
    startedAtRef.current = startedAt;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const next = Math.max(0, Math.round(totalMs - elapsed));
      setRemainingMs(next);
    };

    tick();
    const interval = window.setInterval(tick, 50);
    return () => window.clearInterval(interval);
  }, [isRunning, timeValue]);

  const countdownLabel = useMemo(() => {
    if (!isRunning || remainingMs == null) return null;
    const seconds = remainingMs / 1000;
    const formatted = seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2);
    return `${formatted}s`;
  }, [isRunning, remainingMs]);

  const setTimeValue = useCallback(
    (nextValue: number) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...(node.data ?? {}),
                  timeValue: nextValue,
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
        nodeType="timerInput"
        icon={<Timer className="h-4 w-4" />}
        label={label}
        onConfigClick={() => setIsDialogOpen(true)}
        variant="inputOutput"
        sublabel={countdownLabel}
        disableRuntimeStyles={false}
      />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar nodo</DialogTitle>
          </DialogHeader>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-900"
              htmlFor={inputId}
            >
              Tiempo de espera, en segundos:
            </label>
            <div className="flex">
              <Button
                className="rounded-r-none"
                onClick={() => setTimeValue(timeValue - 1)}
              >
                <Minus />
              </Button>
              <Input
                type="number"
                id={inputId}
                value={timeValue}
                onChange={(e) => {
                  const next = e.currentTarget.valueAsNumber;
                  setTimeValue(Number.isFinite(next) ? next : 0);
                }}
                className="rounded-none"
                step={0.01}
              />
              <Button
                className="rounded-l-none"
                onClick={() => setTimeValue(timeValue + 1)}
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

TimerInputNode.displayName = "TimerInputNode";
