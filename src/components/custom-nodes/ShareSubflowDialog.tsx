import { useMemo, useState } from "react";
import { PictureInPicture2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ShareSubflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subflowName: string;
  inCount: number;
  outCount: number;
  onConfirm: (payload: { name: string; description: string }) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
};

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) {
    return [];
  }

  if (safeCount === 1) {
    return ["50%"];
  }

  const start = 15;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from(
    { length: safeCount },
    (_, index) => `${start + step * index}%`,
  );
}

export function ShareSubflowDialog({
  open,
  onOpenChange,
  subflowName,
  inCount,
  outCount,
  onConfirm,
  isSubmitting = false,
  submitError = null,
}: ShareSubflowDialogProps) {
  const initialShareName = useMemo(
    () => subflowName.trim() || "Subflujo",
    [subflowName],
  );
  const [shareName, setShareName] = useState(initialShareName);
  const [shareDescription, setShareDescription] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setShareName(initialShareName);
      setShareDescription("");
    }
  };

  const previewName = shareName.trim() || "Subflujo";
  const canConfirm = shareName.trim().length > 0;

  const inOffsets = useMemo(() => offsets(inCount), [inCount]);
  const outOffsets = useMemo(() => offsets(outCount), [outCount]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartir nodo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Puedes cambiar el nombre con el que se compartirá este nodo.
          </p>

          <Input
            value={shareName}
            onChange={(event) => setShareName(event.currentTarget.value)}
            placeholder="Escribe el nombre del subflujo"
            disabled={isSubmitting}
          />

          <Input
            value={shareDescription}
            onChange={(event) => setShareDescription(event.currentTarget.value)}
            placeholder="Descripción breve"
            disabled={isSubmitting}
          />

          {submitError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {submitError}
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Vista previa del nodo
            </p>

            <div className="mx-auto w-full max-w-md px-4 py-2">
              <div className="relative">
                <div className="relative flex min-h-28 items-center justify-center rounded-[2rem] border border-violet-700 bg-violet-500 pl-6 pr-10 py-4 text-white shadow-md">
                  {inOffsets.map((offset) => (
                    <span
                      key={`preview-in-${offset}`}
                      className="absolute left-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-700 bg-white"
                      style={{ top: offset }}
                    />
                  ))}

                  {outOffsets.map((offset) => (
                    <span
                      key={`preview-out-${offset}`}
                      className="absolute right-0 h-4 w-4 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-700 bg-white"
                      style={{ top: offset }}
                    />
                  ))}

                  <div className="flex w-full items-center justify-between gap-6">
                    <span className="text-2xl leading-tight">
                      {inOffsets.length > 0 ? "Entrada 1" : ""}
                    </span>

                    <div className="mr-3 flex flex-col items-center justify-center">
                      <PictureInPicture2 className="h-10 w-10" />
                      <span className="text-xl font-medium leading-tight text-center">
                        {previewName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-(--nodi-blue) hover:bg-blue-600"
              disabled={!canConfirm || isSubmitting}
              onClick={() =>
                onConfirm({
                  name: shareName.trim(),
                  description: shareDescription.trim(),
                })
              }
            >
              {isSubmitting ? "Compartiendo..." : "Compartir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
