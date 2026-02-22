import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchLatestPublishedProjects,
  type PublicProjectSummary,
} from "@/lib/projects";

export function RecentPublishedProjectsSection() {
  const [projects, setProjects] = useState<PublicProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    fetchLatestPublishedProjects(12)
      .then((items) => {
        if (!isMounted) return;
        setProjects(items);
      })
      .catch(() => {
        if (!isMounted) return;
        setError("No se pudieron cargar los proyectos destacados.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

      {error ? <p className="mt-4 text-red-600">{error}</p> : null}

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
                  <p className="truncate text-xl font-semibold text-violet-600">
                    {project.name}
                  </p>
                  <p className="truncate text-slate-600">
                    {project.authorName}
                  </p>
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
