import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RemovedNodeItem = {
  type: string;
  label: string;
};

type AbstractionLevelChangeDialogProps = {
  open: boolean;
  targetLevel: 1 | 2 | 3;
  nodesToRemove: RemovedNodeItem[];
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AbstractionLevelChangeDialog({
  open,
  targetLevel,
  nodesToRemove,
  onOpenChange,
  onCancel,
  onConfirm,
}: AbstractionLevelChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar nivel de abstracción</DialogTitle>
          <DialogDescription>
            Al cambiar al nivel {targetLevel}, los siguientes nodos se
            eliminarán porque no pertenecen a ese nivel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/30 p-2">
            <ul className="space-y-1 text-sm">
              {nodesToRemove.map((node) => (
                <li key={node.type} className="rounded bg-background px-2 py-1">
                  {node.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirm}>
              Confirmar y eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
