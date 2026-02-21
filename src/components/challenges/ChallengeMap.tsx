import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  ChallengeDefinition,
  ChallengeId,
} from "@/challenges/definitions";
import type { ChallengeStatus } from "@/challenges/progress";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import { Button } from "../ui/button";
import { Play } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_STYLE: Record<
  ChallengeStatus,
  { fill: string; stroke: string; ring: string; label: string }
> = {
  locked: {
    fill: "rgba(148, 163, 184, 0.65)",
    stroke: "rgba(241, 245, 249, 0.45)",
    ring: "rgba(15, 23, 42, 0.55)",
    label: "Bloqueado",
  },
  available: {
    fill: "rgba(245, 158, 11, 0.95)",
    stroke: "rgba(255, 255, 255, 0.85)",
    ring: "rgba(15, 23, 42, 0.55)",
    label: "Disponible",
  },
  completed: {
    fill: "rgba(34, 197, 94, 0.95)",
    stroke: "rgba(255, 255, 255, 0.85)",
    ring: "rgba(15, 23, 42, 0.55)",
    label: "Completado",
  },
};

// Carga dinámica de imágenes de retos: los archivos deben llamarse como el id
// del desafío (p. ej. `1.png`, `challenge-2.svg`). Se usa `import.meta.glob` para
// que Vite procese/optimice los assets y nos devuelva URLs.
const _rawChallengeImages = import.meta.glob(
  "../../assets/challenges/*.{png,jpg,svg}",
  { eager: true, as: "url" },
) as Record<string, string>;

const challengeImages: Record<string, string> = {};
Object.entries(_rawChallengeImages).forEach(([p, url]) => {
  const name = p.split("/").pop()?.replace(/\.(png|jpg|svg)$/i, "") || "";
  if (name) challengeImages[name] = url;
});
export type ChallengeMapProps = {
  backgroundHref: string;
  viewBox: { width: number; height: number };
  challenges: ChallengeDefinition[];
  statuses: Record<ChallengeId, ChallengeStatus>;
  initialSelectedId?: ChallengeId | null;
  className?: string;
};

export function ChallengeMap({
  backgroundHref,
  viewBox,
  challenges,
  statuses,
  initialSelectedId = null,
  className,
}: ChallengeMapProps) {
  const sorted = useMemo(
    () => [...challenges].sort((a, b) => a.mapPoint.x - b.mapPoint.x),
    [challenges],
  );

  const minDim = Math.min(viewBox.width, viewBox.height);
  const innerR = Math.max(36, minDim * 0.01);
  const outerR = innerR * 1.2;

  const [selectedId, setSelectedId] = useState<ChallengeId | null>(null);
  const lastInitialIdRef = useRef<ChallengeId | null>(null);

  useEffect(() => {
    if (!initialSelectedId) return;
    const hasSelection =
      selectedId && challenges.some((challenge) => challenge.id === selectedId);
    if (lastInitialIdRef.current !== initialSelectedId && !hasSelection) {
      lastInitialIdRef.current = initialSelectedId;
      // Try to simulate a user click on the corresponding button so the
      // Popover opens exactly as when the user clicks it (matching position
      // and animation). Fallback to setting state if the button is not found.
      const selector = `button[data-challenge-id="${initialSelectedId}"]`;
      const btn = document.querySelector(selector) as HTMLButtonElement | null;
      if (btn) {
        // Small timeout to allow layout/portal to stabilize before clicking.
        setTimeout(() => btn.click(), 50);
        setSelectedId(initialSelectedId);
      } else {
        setSelectedId(initialSelectedId);
      }
    }
  }, [challenges, initialSelectedId, selectedId]);

  const resolvePoint = (point: { x: number; y: number }) => {
    const isNormalized = point.x <= 1 && point.y <= 1;
    return isNormalized
      ? { x: point.x * viewBox.width, y: point.y * viewBox.height }
      : point;
  };

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <svg
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="none"
        className="block h-full w-full select-none"
        role="img"
        aria-label="Mapa de desafíos"
        style={{ pointerEvents: "none" }}
      >
        <image
          href={backgroundHref}
          x={0}
          y={0}
          width={viewBox.width}
          height={viewBox.height}
        />

        {sorted.map((challenge, idx) => {
          const status = statuses[challenge.id] ?? "locked";
          const style = STATUS_STYLE[status];
          const isSelected = selectedId === challenge.id;

          const point = resolvePoint(challenge.mapPoint);

          const delay = `${idx * 80}ms`;

          return (
            <g
              key={challenge.id}
              className="map-point-appear"
              style={{ animationDelay: delay }}
            >
              <title>
                {challenge.title} — {style.label}
              </title>

              <circle
                cx={point.x}
                cy={point.y}
                r={outerR}
                fill={style.ring}
                opacity={isSelected ? 0.9 : 0.65}
                pointerEvents="none"
              />

              <circle
                cx={point.x}
                cy={point.y}
                r={innerR}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={3}
                pointerEvents="none"
              />

              {isSelected ? (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={innerR + 6}
                  fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth={3}
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* HTML overlay for interactive Popover triggers */}
      <div className="absolute inset-0 pointer-events-none">
        {sorted.map((challenge, idx) => {
          const status = statuses[challenge.id] ?? "locked";
          const style = STATUS_STYLE[status];
          const point = resolvePoint(challenge.mapPoint);
          const left = (point.x / viewBox.width) * 100;
          const top = (point.y / viewBox.height) * 100;
          const delay = `${idx * 80}ms`;

          return (
            <div
              key={challenge.id}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 map-button-appear",
              )}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                pointerEvents: "auto",
                animationDelay: delay,
              }}
            >
              <div className="relative">
                <div
                  className="relative"
                  style={{ width: `${innerR * 2}px`, height: `${innerR * 2}px` }}
                >
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {status === "locked" ? (
                      <Button
                        aria-label={`${challenge.title} — ${style.label}`}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full border-2",
                          {
                            "bg-slate-400 border-slate-600 hover:bg-slate-400 hover:cursor-default":
                              status === "locked",
                          },
                        )}
                      />
                    ) : (
                      <Popover>
                        <PopoverTrigger>
                          <Button
                            aria-label={`${challenge.title} — ${style.label}`}
                            data-challenge-id={challenge.id}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full border-2",
                              {
                                "bg-amber-500 border-amber-600 hover:bg-amber-600 hover:border-amber-700":
                                  status === "available",
                                "bg-emerald-500 border-emerald-600 hover:bg-emerald-600 hover:border-emerald-700":
                                  status === "completed",
                              },
                            )}
                            onClick={() => setSelectedId(challenge.id)}
                          />
                        </PopoverTrigger>

                        <PopoverContent sideOffset={16} className="w-64">
                          <PopoverHeader>
                            <PopoverTitle>{challenge.title}</PopoverTitle>
                          </PopoverHeader>
                          <PopoverDescription>
                            <div className="text-sm mb-2">{challenge.description}</div>
                            <div className="flex items-center gap-3 text-xs">
                              <span>Grupo: {challenge.group}</span>
                              <span>Nivel: {challenge.level}</span>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button className="ml-auto inline-flex items-center gap-2 rounded-lg bg-green-600/90 hover:bg-green-600 px-3 py-2 text-sm  text-white">
                                <Link to={`/editor/${challenge.id}`} className="font-normal">
                                  Iniciar reto{" "}
                                  <Play fill="white" className="inline" />
                                </Link>
                              </Button>
                            </div>
                          </PopoverDescription>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {challengeImages[challenge.id] ? (
                    <img
                      src={challengeImages[challenge.id]}
                      alt={challenge.title}
                      style={{
                        position: "absolute",
                        left: `${innerR -100 }px`,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: `${innerR * 10}px`,
                        height: `${innerR * 10}px`,
                        maxWidth: "none",
                        maxHeight: "none",
                      }}
                      className="object-contain pointer-events-none rounded"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
