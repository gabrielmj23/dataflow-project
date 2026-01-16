import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateSubflowDialog({
  open,
  onOpenChange,
  createSubflowError,
  pendingSubflowPorts,
  subflowName,
  onSubflowNameChange,
  createSubflowNameError,
  addSubflowToPalette,
  onAddSubflowToPaletteChange,
  canSave,
  onCancel,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createSubflowError: string | null;
  pendingSubflowPorts: { inCount: number; outCount: number } | null;
  subflowName: string;
  onSubflowNameChange: (value: string) => void;
  createSubflowNameError: string | null;
  addSubflowToPalette: boolean;
  onAddSubflowToPaletteChange: (checked: boolean) => void;
  canSave: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Subflujo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {createSubflowError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {createSubflowError}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Entradas: {pendingSubflowPorts?.inCount ?? 0} · Salidas:{" "}
                {pendingSubflowPorts?.outCount ?? 0}
              </p>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Nombre del subflujo:
                </label>
                <Input
                  value={subflowName}
                  onChange={(e) => onSubflowNameChange(e.currentTarget.value)}
                  placeholder="Ej: Validar datos"
                />
              </div>
              {createSubflowNameError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  {createSubflowNameError}
                </div>
              )}
              <label className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={addSubflowToPalette}
                  onChange={(e) =>
                    onAddSubflowToPaletteChange(e.currentTarget.checked)
                  }
                />
                <span>Añadir este subflujo a la paleta</span>
              </label>
            </>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {createSubflowError ? "Cerrar" : "Cancelar"}
            </Button>
            {!createSubflowError && (
              <Button type="button" disabled={!canSave} onClick={onSave}>
                Guardar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
