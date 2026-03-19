import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { moderateImageDataUrl } from "@/lib/image-moderation";

type PublishProjectDialogProps = {
  open: boolean;
  mode?: "create-private" | "save-private" | "publish";
  isAuthenticated: boolean;
  defaultName: string;
  defaultDescription?: string;
  defaultGuestAuthorName?: string;
  thumbnailPreview: string | null;
  isGeneratingPreview: boolean;
  remixSourceName?: string | null;
  isPublishing: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    projectName: string,
    projectDescription: string,
    thumbnailOverride: string | null,
    guestAuthorName: string,
    shouldPublishNow: boolean,
  ) => void;
};

export function PublishProjectDialog({
  open,
  mode = "create-private",
  isAuthenticated,
  defaultName,
  defaultDescription = "",
  defaultGuestAuthorName = "",
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
  const [guestAuthorName, setGuestAuthorName] = useState(
    defaultGuestAuthorName,
  );
  const [thumbnailOverride, setThumbnailOverride] = useState<string | null>(
    null,
  );
  const [guestAuthorNameError, setGuestAuthorNameError] = useState<
    string | null
  >(null);
  const [thumbnailOverrideError, setThumbnailOverrideError] = useState<
    string | null
  >(null);
  const [isAnalyzingThumbnail, setIsAnalyzingThumbnail] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(false);
  const guestAuthorId = useId();
  const projectNameId = useId();
  const projectDescriptionId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;

  useEffect(() => {
    if (open) {
      setProjectName(defaultName);
      setProjectDescription(defaultDescription);
      setGuestAuthorName(defaultGuestAuthorName);
      setGuestAuthorNameError(null);
      setThumbnailOverride(null);
      setThumbnailOverrideError(null);
      setIsAnalyzingThumbnail(false);
      setPublishImmediately(false);
    }
  }, [open, defaultName, defaultDescription, defaultGuestAuthorName]);

  const isCreatePrivateMode = mode === "create-private";
  const isSavePrivateMode = mode === "save-private";
  const isPublishMode = mode === "publish";
  const shouldRequireGuestAuthorName =
    !isAuthenticated &&
    (isPublishMode || (isCreatePrivateMode && publishImmediately));
  const effectiveThumbnailPreview = thumbnailOverride ?? thumbnailPreview;

  const handleUploadClick = () => {
    if (isPublishing || isAnalyzingThumbnail) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCustomThumbnailChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setThumbnailOverrideError("Selecciona un archivo de imagen válido.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_THUMBNAIL_BYTES) {
      setThumbnailOverrideError("La imagen no puede superar los 3 MB.");
      event.target.value = "";
      return;
    }

    setIsAnalyzingThumbnail(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setThumbnailOverrideError(
          "No se pudo cargar la imagen seleccionada. Intenta de nuevo.",
        );
        setIsAnalyzingThumbnail(false);
        return;
      }

      try {
        const moderation = await moderateImageDataUrl(result);
        if (!moderation.isAllowed) {
          setThumbnailOverride(null);
          setThumbnailOverrideError(
            moderation.reason ??
              "La imagen no es apta como portada de proyecto.",
          );
          return;
        }

        setThumbnailOverride(result);
        setThumbnailOverrideError(null);
      } catch {
        setThumbnailOverrideError(
          "No se pudo analizar la imagen. Intenta con otra imagen.",
        );
      } finally {
        setIsAnalyzingThumbnail(false);
      }
    };
    reader.onerror = () => {
      setThumbnailOverrideError(
        "No se pudo cargar la imagen seleccionada. Intenta de nuevo.",
      );
      setIsAnalyzingThumbnail(false);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleRemoveCustomThumbnail = () => {
    setThumbnailOverride(null);
    setThumbnailOverrideError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isAnalyzingThumbnail) {
      setThumbnailOverrideError(
        "Espera a que termine el analisis de la imagen antes de publicar.",
      );
      return;
    }

    const normalizedGuestAuthorName = guestAuthorName.trim();
    if (shouldRequireGuestAuthorName && !normalizedGuestAuthorName) {
      setGuestAuthorNameError(
        "Ingresa tu nombre para publicar sin iniciar sesión.",
      );
      return;
    }

    setGuestAuthorNameError(null);
    onConfirm(
      projectName.trim(),
      projectDescription.trim(),
      thumbnailOverride,
      normalizedGuestAuthorName,
      publishImmediately,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreatePrivateMode
              ? "Guardar proyecto"
              : isSavePrivateMode
                ? "Guardar cambios"
                : "Publicar proyecto"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 overflow-y-auto max-h-[90vh]"
        >
          {remixSourceName ? (
            <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">
              {isPublishMode
                ? "Se publicará como remix de "
                : "Se guardará como remix de "}
              <span className="font-medium">{remixSourceName}</span>.
            </p>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {effectiveThumbnailPreview ? (
              <img
                src={effectiveThumbnailPreview}
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleUploadClick}
              disabled={isPublishing || isAnalyzingThumbnail}
            >
              {isAnalyzingThumbnail
                ? "Analizando imagen..."
                : thumbnailOverride
                  ? "Cambiar imagen"
                  : "Subir imagen"}
            </Button>

            {thumbnailOverride ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemoveCustomThumbnail}
                disabled={isPublishing || isAnalyzingThumbnail}
              >
                Quitar imagen
              </Button>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomThumbnailChange}
              disabled={isPublishing || isAnalyzingThumbnail}
            />
          </div>

          {thumbnailOverrideError ? (
            <p className="text-sm text-red-600">{thumbnailOverrideError}</p>
          ) : null}
          {isAnalyzingThumbnail ? (
            <p className="text-sm text-slate-500">Procesando imagen...</p>
          ) : null}

          {!isAuthenticated ? (
            <div className="space-y-1">
              <label
                htmlFor={guestAuthorId}
                className="text-sm font-medium text-slate-700"
              >
                Autor {shouldRequireGuestAuthorName ? "*" : "(opcional)"}
              </label>
              <Input
                id={guestAuthorId}
                value={guestAuthorName}
                onChange={(event) => {
                  setGuestAuthorName(event.target.value);
                  if (guestAuthorNameError) {
                    setGuestAuthorNameError(null);
                  }
                }}
                placeholder="Tu nombre"
                disabled={isPublishing}
              />
              {guestAuthorNameError ? (
                <p className="text-sm text-red-600">{guestAuthorNameError}</p>
              ) : null}
            </div>
          ) : null}

          {isCreatePrivateMode ? (
            <label className="flex items-start hover:cursor-pointer gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(event) =>
                  setPublishImmediately(event.target.checked)
                }
                disabled={isPublishing}
                className="mt-0.5"
              />
              <span>
                Hacer público
                <span className="block text-xs text-slate-500">
                  Si lo marcas, el proyecto estará disponible para todos en la
                  comunidad
                </span>
              </span>
            </label>
          ) : null}

          <div className="space-y-1">
            <label
              htmlFor={projectNameId}
              className="text-sm font-medium text-slate-700"
            >
              Título
            </label>
            <Input
              id={projectNameId}
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Nombre del proyecto"
              disabled={isPublishing}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor={projectDescriptionId}
              className="text-sm font-medium text-slate-700"
            >
              Descripción
            </label>
            <textarea
              id={projectDescriptionId}
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="Descripción del proyecto (opcional)"
              disabled={isPublishing}
              rows={4}
              className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPublishing || isAnalyzingThumbnail}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPublishing || isAnalyzingThumbnail}
            >
              {isPublishing
                ? isPublishMode
                  ? "Publicando..."
                  : "Guardando..."
                : isCreatePrivateMode
                  ? publishImmediately
                    ? "Guardar y publicar"
                    : "Guardar proyecto"
                  : isSavePrivateMode
                    ? "Guardar cambios"
                    : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
