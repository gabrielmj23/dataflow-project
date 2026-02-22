import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PublishProjectDialogProps = {
  open: boolean;
  defaultName: string;
  thumbnailPreview: string | null;
  isGeneratingPreview: boolean;
  remixSourceName?: string | null;
  isPublishing: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (projectName: string) => void;
};

export function PublishProjectDialog({
  open,
  defaultName,
  thumbnailPreview,
  isGeneratingPreview,
  remixSourceName,
  isPublishing,
  error,
  onOpenChange,
  onConfirm,
}: PublishProjectDialogProps) {
  const [projectName, setProjectName] = useState(defaultName);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectName(defaultName);
    }
  }, [open, defaultName]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm(projectName.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publicar proyecto</DialogTitle>
          <DialogDescription>
            Confirma el nombre antes de publicar tu proyecto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {remixSourceName ? (
            <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">
              Se publicará como remix de <span className="font-medium">{remixSourceName}</span>.
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {thumbnailPreview ? (
              <img
                src={thumbnailPreview}
                alt="Vista previa del proyecto"
                className="h-40 w-full object-cover"
              />
            ) : (
              <div className="flex h-40 items-center justify-center px-4 text-sm text-slate-500">
                {isGeneratingPreview
                  ? "Generando vista previa..."
                  : "No se pudo generar la vista previa."}
              </div>
            )}
          </div>

          <Input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Nombre del proyecto"
            disabled={isPublishing}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPublishing}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPublishing}>
              {isPublishing ? "Publicando..." : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
