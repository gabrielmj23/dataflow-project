import { memo, useCallback, useId, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
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
        icon={<Timer className="h-7 w-7" />}
        label={label}
        onConfigClick={() => setIsDialogOpen(true)}
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
