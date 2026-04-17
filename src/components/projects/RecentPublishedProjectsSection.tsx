import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  fetchLatestPublishedProjects,
  fetchPublishedProjectById,
} from "@/lib/projects";
import { ProjectPreviewDialog } from "@/components/projects/ProjectPreviewDialog";

export function RecentPublishedProjectsSection() {
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["projects", "recent", 12],
    queryFn: () => fetchLatestPublishedProjects(12),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const railRef = useRef<HTMLDivElement | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedProjectDetailQuery = useQuery({
    queryKey: ["projects", "detail", selectedProjectId],
    queryFn: () => fetchPublishedProjectById(selectedProjectId as string),
    enabled: Boolean(selectedProjectId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const filteredProjects = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) return projects;

    return projects.filter((project) => {
      const remixName = project.remixedFromName ?? "";
      return [project.name, project.authorName, remixName].some((value) =>
        value.toLowerCase().includes(normalizedTerm),
      );
    });
  }, [projects, searchTerm]);

  const hasProjects = useMemo(() => projects.length > 0, [projects.length]);
  const hasFilteredProjects = useMemo(
    () => filteredProjects.length > 0,
    [filteredProjects.length],
  );

  const scrollRail = (direction: "left" | "right") => {
    const rail = railRef.current;
    if (!rail) return;

    const amount = Math.max(320, Math.floor(rail.clientWidth * 0.75));
    rail.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="text-4xl font-medium tracking-tight text-emerald-700">
        Proyectos recientes
      </h2>
      <div className="mt-2">
        <p className="text-sm text-slate-800">
          Explora proyectos de la comunidad de NodeLand
        </p>
      </div>

      <label className="mt-3 flex max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <Search size={18} className="text-emerald-700" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar proyecto"
          className="w-full bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-500"
          aria-label="Buscar proyecto"
        />
      </label>

      {isLoading ? (
        <p className="mt-4 text-slate-500">Cargando proyectos...</p>
      ) : null}

      {error ? (
        <p className="mt-4 text-red-600">
          No se pudieron cargar los proyectos destacados.
        </p>
      ) : null}

      {!isLoading && !error && !hasProjects ? (
        <p className="mt-4 text-slate-500">Aún no hay proyectos publicados.</p>
      ) : null}

      {hasFilteredProjects ? (
        <div className="relative mt-4 rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
          <button
            type="button"
            aria-label="Desplazar proyectos a la izquierda"
            className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-300 bg-white/95 p-1.5 text-slate-600 shadow hover:bg-slate-50"
            onClick={() => scrollRail("left")}
          >
            <ChevronLeft size={18} />
          </button>

          <div
            ref={railRef}
            className="mx-9 flex gap-4 overflow-x-auto scroll-smooth pt-1 pb-2"
          >
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="w-56 shrink-0 rounded-lg border border-slate-300 bg-slate-50 text-left transition-all hover:cursor-pointer hover:border-emerald-300 hover:shadow"
                onClick={() => setSelectedProjectId(project.id)}
              >
                {project.thumbnail ? (
                  <img
                    src={project.thumbnail}
                    alt={`Miniatura de ${project.name}`}
                    className="h-32 w-full rounded-t-lg object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center rounded-t-lg bg-slate-100 text-xs font-medium text-slate-500">
                    Sin miniatura
                  </div>
                )}

                <div className="p-3">
                  {project.remixedFromId ? (
                    <p className="mb-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Remix
                    </p>
                  ) : null}

                  <p className="truncate text-xl font-semibold text-emerald-700">
                    {project.name}
                  </p>
                  <p className="truncate text-slate-600">
                    {project.authorName}
                  </p>
                  {project.remixedFromName ? (
                    <p className="truncate text-xs text-slate-500">
                      Remix de {project.remixedFromName}
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label="Desplazar proyectos a la derecha"
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-300 bg-white/95 p-1.5 text-slate-600 shadow hover:bg-slate-50"
            onClick={() => scrollRail("right")}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : null}

      {!isLoading && !error && hasProjects && !hasFilteredProjects ? (
        <p className="mt-4 text-slate-600">
          No encontramos proyectos que coincidan con "{searchTerm}".
        </p>
      ) : null}

      <ProjectPreviewDialog
        open={Boolean(selectedProjectId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProjectId(null);
          }
        }}
        project={selectedProject}
        projectDetail={selectedProjectDetailQuery.data}
        isLoadingDetail={selectedProjectDetailQuery.isLoading}
        isDetailError={selectedProjectDetailQuery.isError}
      />
    </section>
  );
}
