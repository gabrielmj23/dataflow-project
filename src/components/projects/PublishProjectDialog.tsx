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
  mode?: "publish" | "save";
  defaultName: string;
  defaultDescription?: string;
  thumbnailPreview: string | null;
  isGeneratingPreview: boolean;
  remixSourceName?: string | null;
  isPublishing: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (projectName: string, projectDescription: string) => void;
};

export function PublishProjectDialog({
  open,
  mode = "publish",
  defaultName,
  defaultDescription = "",
  thumbnailPreview,
  isGeneratingPreview,
  remixSourceName,
  isPublishing,
  error,
  onOpenChange,
  onConfirm,
}: PublishProjectDialogProps) {
  const [projectName, setProjectName] = useState(defaultName);
  const [projectDescription, setProjectDescription] =
    useState(defaultDescription);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectName(defaultName);
      setProjectDescription(defaultDescription);
    }
  }, [open, defaultName, defaultDescription]);

  const isSaveMode = mode === "save";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onConfirm(projectName.trim(), projectDescription.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSaveMode ? "Guardar cambios" : "Publicar proyecto"}
          </DialogTitle>
          <DialogDescription>
            {isSaveMode
              ? "Edita el título y la descripción para actualizar tu proyecto."
              : "Confirma el nombre y la descripción antes de publicar tu proyecto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {remixSourceName ? (
            <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">
              Se publicará como remix de{" "}
              <span className="font-medium">{remixSourceName}</span>.
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

          <textarea
            value={projectDescription}
            onChange={(event) => setProjectDescription(event.target.value)}
            placeholder="Descripción del proyecto (opcional)"
            disabled={isPublishing}
            rows={4}
            className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
              {isPublishing
                ? isSaveMode
                  ? "Guardando..."
                  : "Publicando..."
                : isSaveMode
                  ? "Guardar cambios"
                  : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
