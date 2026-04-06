import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DeleteExtensionDialog({
  open,
  extensionName,
  onOpenChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  extensionName: string | null;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar extension de la paleta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres eliminar{" "}
            {extensionName ? `"${extensionName}"` : "esta extension"} de la
            paleta? Los nodos ya colocados en el diagrama no se borrarán.
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirm}>
              Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
