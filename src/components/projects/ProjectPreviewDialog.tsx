import { Link } from "react-router-dom";
import { Download, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicProjectSummary, PublishedProject } from "@/lib/projects";
import { downloadSerializedProgram } from "@/flow/serialization";

type ProjectPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: PublicProjectSummary | null;
  projectDetail?: PublishedProject;
  isLoadingDetail: boolean;
  isDetailError: boolean;
};

function buildProjectUrl(projectId: string): string {
  const path = `/editor/${projectId}`;
  if (typeof window === "undefined") {
    return path;
  }
  return `${window.location.origin}${path}`;
}

function toDownloadFilename(projectName: string): string {
  const base = projectName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "proyecto"}.json`;
}

export function ProjectPreviewDialog({
  open,
  onOpenChange,
  project,
  projectDetail,
  isLoadingDetail,
  isDetailError,
}: ProjectPreviewDialogProps) {
  const projectId = project?.id ?? projectDetail?.id;
  const projectName = projectDetail?.name ?? project?.name ?? "Proyecto";
  const description =
    projectDetail?.description?.trim() || "Sin descripción disponible.";
  const thumbnail = projectDetail?.thumbnail ?? project?.thumbnail ?? null;

  const handleShare = async () => {
    if (!projectId) return;
    const url = buildProjectUrl(projectId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles.");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  const handleDownload = () => {
    if (!projectDetail?.program) return;
    downloadSerializedProgram(
      projectDetail.program,
      toDownloadFilename(projectName),
    );
    toast.success("Proyecto descargado.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="gap-0">
          <DialogTitle className="text-2xl text-slate-800">
            {projectName}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            hecho por{" "}
            {projectDetail?.authorName ??
              project?.authorName ??
              "Autor desconocido"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={`Miniatura de ${projectName}`}
              className="h-80 w-full rounded-lg border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-80 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-500">
              Sin miniatura
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-2xl font-semibold text-slate-800">
              Descripción
            </h3>
            {isLoadingDetail ? (
              <p className="mt-3 text-slate-500">Cargando detalles...</p>
            ) : isDetailError ? (
              <p className="mt-3 text-red-600">
                No se pudo cargar la descripción del proyecto.
              </p>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-slate-700">
                {description}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleShare}
            disabled={!projectId}
          >
            <Link2 size={16} />
            Compartir
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={!projectDetail?.program}
          >
            <Download size={16} />
            Descargar
          </Button>
          <Button
            asChild
            disabled={!projectId}
            className="bg-(--nodi-blue) hover:bg-blue-600"
          >
            <Link to={projectId ? `/editor/${projectId}` : "#"}>
              <ExternalLink size={16} />
              Ver proyecto
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
