import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type {
  ChallengeDefinition,
  ChallengeId,
} from "@/challenges/challenge-registry";
import type { ChallengeStatus } from "@/challenges/progress";

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

export type ChallengeMapProps = {
  backgroundHref: string;
  viewBox: { width: number; height: number };
  challenges: ChallengeDefinition[];
  statuses: Record<ChallengeId, ChallengeStatus>;
  selectedId?: ChallengeId | null;
  onSelect: (id: ChallengeId) => void;
  className?: string;
};

export function ChallengeMap({
  backgroundHref,
  viewBox,
  challenges,
  statuses,
  selectedId,
  onSelect,
  className,
}: ChallengeMapProps) {
  const sorted = useMemo(
    () => [...challenges].sort((a, b) => a.mapPoint.x - b.mapPoint.x),
    [challenges],
  );

  const minDim = Math.min(viewBox.width, viewBox.height);
  const innerR = Math.max(14, minDim * 0.01);
  const outerR = innerR * 1.4;

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
      >
        <image
          href={backgroundHref}
          x={0}
          y={0}
          width={viewBox.width}
          height={viewBox.height}
        />

        {sorted.map((challenge) => {
          const status = statuses[challenge.id] ?? "locked";
          const style = STATUS_STYLE[status];
          const isSelected = selectedId === challenge.id;

          const point = resolvePoint(challenge.mapPoint);

          return (
            <g
              key={challenge.id}
              role="button"
              tabIndex={0}
              aria-label={`${challenge.title}. ${style.label}.`}
              onClick={() => onSelect(challenge.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(challenge.id);
                }
              }}
              style={{ cursor: "pointer" }}
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
              />

              <circle
                cx={point.x}
                cy={point.y}
                r={innerR}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={3}
              />

              {isSelected ? (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={innerR + 6}
                  fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth={3}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
