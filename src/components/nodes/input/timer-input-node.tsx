import { memo, useId, useState } from "react";
import type { NodeProps } from "@xyflow/react";
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
};

export const TimerInputNode = memo(({ data }: NodeProps) => {
  const { label = "Timer" } = (data ?? {}) as TimerInputNodeData;
  const [timeValue, setTimeValue] = useState<number>(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const inputId = useId();

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
                onChange={(e) => setTimeValue(Number(e.target.value))}
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
