import { useMemo, useState, type ChangeEvent } from "react";
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
import { PlusCircle, Check } from "lucide-react";

type ShareSubflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subflowName: string;
  onConfirm: (payload: {
    name: string;
    description: string;
    newExtension?: { name: string; description: string; color: string };
  }) => void;
  availableExtensions: ExtensionListItem[];
  selectedExtensionIds: string[];
  onToggleExtension: (extensionId: string) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
};

export function ShareSubflowDialog({
  open,
  onOpenChange,
  subflowName,
  onConfirm,
  availableExtensions,
  selectedExtensionIds,
  onToggleExtension,
  isSubmitting = false,
  submitError = null,
}: ShareSubflowDialogProps) {
  const initialShareName = useMemo(
    () => subflowName.trim() || "Subflujo",
    [subflowName]
  );
  const [shareName, setShareName] = useState(initialShareName);
  const [shareDescription, setShareDescription] = useState("");

  const [isCreatingExtension, setIsCreatingExtension] = useState(false);
  const [newExtName, setNewExtName] = useState("");
  const [newExtDescription, setNewExtDescription] = useState("");
  const [newExtColor, setNewExtColor] = useState("#3b82f6");

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setShareName(initialShareName);
      setShareDescription("");
      setIsCreatingExtension(false);
      setNewExtName("");
      setNewExtDescription("");
      setNewExtColor("#3b82f6");
    }
  };

  const canConfirm =
    shareName.trim().length > 0 &&
    (isCreatingExtension
      ? newExtName.trim().length > 0 && newExtDescription.trim().length > 0
      : selectedExtensionIds.length > 0);

  const handleConfirm = () => {
    if (!canConfirm) return;

    onConfirm({
      name: shareName.trim(),
      description: shareDescription.trim(),
      newExtension: isCreatingExtension
        ? {
            name: newExtName.trim(),
            description: newExtDescription.trim(),
            color: newExtColor,
          }
        : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir nodo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <label htmlFor="share-name" className="text-sm font-medium">Nombre del subflujo</label>
            <Input
              id="share-name"
              value={shareName}
              onChange={(event) => setShareName(event.currentTarget.value)}
              placeholder="Escribe el nombre del subflujo"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="share-description" className="text-sm font-medium">Descripción</label>
            <textarea
              id="share-description"
              value={shareDescription}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setShareDescription(event.currentTarget.value)}
              placeholder="Descripción breve"
              disabled={isSubmitting}
              className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Destino</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                className={cn(
                  "flex items-center justify-between rounded-md border px-3 py-3 text-left transition-all",
                  isCreatingExtension
                    ? "border-(--nodi-blue) bg-blue-50 ring-1 ring-blue-500/20"
                    : "border-border hover:bg-muted/50"
                )}
                onClick={() => {
                  setIsCreatingExtension(true);
                }}
                disabled={isSubmitting}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <PlusCircle size={18} />
                  </div>
                  <div>
                    <span className="text-sm font-medium block">
                      Crear una nueva extensión
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Publicar en una nueva colección
                    </span>
                  </div>
                </div>
                {isCreatingExtension && (
                  <Check size={16} className="text-(--nodi-blue)" />
                )}
              </button>

              {availableExtensions.length > 0 && (
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-muted" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground font-medium">
                      O elige existentes
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableExtensions.map((extension) => {
                  const selected =
                    !isCreatingExtension &&
                    selectedExtensionIds.includes(extension.id);
                  return (
                    <button
                      key={extension.id}
                      type="button"
                      className={cn(
                        "rounded-md border px-3 py-2 text-left transition-all",
                        selected
                          ? "border-(--nodi-blue) bg-blue-50 ring-1 ring-blue-500/20 shadow-xs"
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => {
                        setIsCreatingExtension(false);
                        onToggleExtension(extension.id);
                      }}
                      disabled={isSubmitting}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5"
                          style={{ backgroundColor: extension.color }}
                        />
                        <span className="text-sm font-medium line-clamp-1">
                          {extension.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {isCreatingExtension && (
              <div className="mt-4 space-y-3 rounded-md border border-blue-100 bg-blue-50/30 p-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold block">
                    Nombre de la extensión
                  </span>
                  <Input
                    value={newExtName}
                    onChange={(e) => setNewExtName(e.target.value)}
                    placeholder="E.g. Mis Utilidades"
                    className="h-8 text-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold block">
                    Descripción
                  </span>
                  <Input
                    value={newExtDescription}
                    onChange={(e) => setNewExtDescription(e.target.value)}
                    placeholder="¿De qué trata esta colección?"
                    className="h-8 text-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold block">
                    Color de identidad
                  </span>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={newExtColor}
                      onChange={(e) => setNewExtColor(e.target.value)}
                      className="h-8 w-12 p-0.5 cursor-pointer"
                      disabled={isSubmitting}
                    />
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">
                      {newExtColor}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isCreatingExtension && selectedExtensionIds.length === 0 ? (
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2.5 text-xs text-blue-800">
              Selecciona una extensión existente o crea una nueva para publicar el nodo.
            </div>
          ) : null}

          {submitError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              {submitError}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
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
              onClick={handleConfirm}
            >
              {isSubmitting ? "Compartiendo..." : "Confirmar y compartir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
