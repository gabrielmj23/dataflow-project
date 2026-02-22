import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchLatestPublishedProjects } from "@/lib/projects";

export function RecentPublishedProjectsSection() {
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["projects", "recent", 12],
    queryFn: () => fetchLatestPublishedProjects(12),
  });

  const railRef = useRef<HTMLDivElement | null>(null);

  const hasProjects = useMemo(() => projects.length > 0, [projects.length]);

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
      <h2 className="text-2xl font-bold text-slate-800">Proyectos recientes</h2>

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

      {hasProjects ? (
        <div className="relative mt-4">
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
            className="mx-9 flex gap-4 overflow-x-auto scroll-smooth py-1"
          >
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/editor/${project.id}`}
                className="w-56 shrink-0 rounded-lg border border-slate-200 bg-white"
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
                    <p className="mb-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                      Remix
                    </p>
                  ) : null}

                  <p className="truncate text-xl font-semibold text-violet-600">
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
              </Link>
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
    </section>
  );
}
