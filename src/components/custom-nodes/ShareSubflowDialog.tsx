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
import { cn } from "@/lib/utils";
import type { ExtensionListItem } from "@/lib/extensions";

type ShareSubflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subflowName: string;
  inCount: number;
  outCount: number;
  onConfirm: (payload: { name: string; description: string }) => void;
  availableExtensions: ExtensionListItem[];
  selectedExtensionIds: string[];
  onToggleExtension: (extensionId: string) => void;
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
  availableExtensions,
  selectedExtensionIds,
  onToggleExtension,
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
  const canConfirm =
    shareName.trim().length > 0 && selectedExtensionIds.length > 0;

  const inOffsets = useMemo(() => offsets(inCount), [inCount]);
  const outOffsets = useMemo(() => offsets(outCount), [outCount]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartir nodo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[80vh] overflow-y-auto">
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

          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Agregar a extensiones</p>
            <p className="text-xs text-muted-foreground">
              Debes seleccionar al menos una extension para publicar.
            </p>

            {availableExtensions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tienes extensiones disponibles. Crea una desde la barra
                lateral para continuar.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableExtensions.map((extension) => {
                  const selected = selectedExtensionIds.includes(extension.id);
                  return (
                    <button
                      key={extension.id}
                      type="button"
                      className={cn(
                        "rounded-md border px-3 py-2 text-left transition-colors",
                        selected
                          ? "border-(--nodi-blue) bg-blue-50"
                          : "border-border hover:bg-muted",
                      )}
                      onClick={() => onToggleExtension(extension.id)}
                      disabled={isSubmitting}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: extension.color }}
                        />
                        <span className="text-sm font-medium line-clamp-1">
                          {extension.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {extension.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedExtensionIds.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              Debes seleccionar al menos una extension.
            </div>
          ) : null}

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
