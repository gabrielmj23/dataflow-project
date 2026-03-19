import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { fetchMyProjects, fetchPublishedProjectById } from "@/lib/projects";
import { ProjectPreviewDialog } from "@/components/projects/ProjectPreviewDialog";

export function MyProjectsSection() {
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["projects", "mine", 12],
    queryFn: () => fetchMyProjects(12),
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

  if (!isLoading && !error && !hasProjects) {
    return null; // Ocultar si el usuario no tiene proyectos
  }

  return (
    <>
      <section className="w-full rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
        <h2 className="text-4xl font-medium tracking-tight text-blue-500">
          Mis proyectos
        </h2>

        {hasProjects && (
          <label className="mt-3 flex max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Search size={18} className="text-blue-700" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar en mis proyectos"
              className="w-full bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-500"
              aria-label="Buscar en mis proyectos"
            />
          </label>
        )}

        {isLoading ? (
          <p className="mt-4 text-slate-500">Cargando tus proyectos...</p>
        ) : null}

        {error ? (
          <p className="mt-4 text-red-600">
            No se pudieron cargar tus proyectos.
          </p>
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
              className="mx-9 flex gap-4 overflow-x-auto scroll-smooth pt-1 pb-2 scrollbar-none"
            >
              <Link
                to="/editor"
                className="group flex w-56 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-white transition-all hover:border-blue-400 hover:bg-blue-50/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-transform group-hover:scale-110">
                  <Plus size={24} />
                </div>
                <span className="text-lg font-medium text-slate-700">
                  Nuevo proyecto
                </span>
              </Link>

              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="w-56 shrink-0 rounded-lg border border-slate-300 bg-slate-50 text-left transition-all hover:cursor-pointer hover:border-blue-400 hover:shadow"
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
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <p
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${project.isPublic ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
                      >
                        {project.isPublic ? "Público" : "Privado"}
                      </p>
                      {project.remixedFromId ? (
                        <p className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-500">
                          Remix
                        </p>
                      ) : null}
                    </div>

                    <p className="truncate text-xl font-semibold text-blue-500">
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
      </section>

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
    </>
  );
}
