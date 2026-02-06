import { useMemo, useState } from "react";
import {
  CHALLENGE_MAP_VIEWBOX,
  challengeRegistry,
  type ChallengeId,
} from "@/challenges/challenge-registry";
import {
  getChallengeStatuses,
  loadChallengeProgress,
} from "@/challenges/progress";
import { ChallengeMap } from "@/components/challenges/ChallengeMap";
import AppHeader from "@/components/app-header";

export default function ChallengesPage() {
  const [progress] = useState(() => loadChallengeProgress());

  const statuses = useMemo(
    () => getChallengeStatuses(challengeRegistry, progress),
    [progress],
  );

  const firstSuggestedId = useMemo<ChallengeId | null>(() => {
    const firstAvailable = challengeRegistry.find(
      (challenge) => statuses[challenge.id] === "available",
    )?.id;
    return firstAvailable ?? challengeRegistry[0]?.id ?? null;
  }, [statuses]);

  const [selectedId, setSelectedId] = useState<ChallengeId | null>(
    firstSuggestedId,
  );

  const backgroundHref = "/challenge-map.png";

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden">
      <ChallengeMap
        backgroundHref={backgroundHref}
        viewBox={CHALLENGE_MAP_VIEWBOX}
        challenges={challengeRegistry}
        statuses={statuses}
        selectedId={selectedId}
        onSelect={setSelectedId}
        className="absolute inset-0 z-0 h-full w-full"
      />

      <div className="relative z-10 flex h-screen flex-col pointer-events-none">
        <div className="pointer-events-auto">
          <AppHeader centerTitle="Desafíos" />
        </div>

        <div className="flex-1 flex flex-col md:flex-row px-6 py-10 gap-6"></div>
      </div>
    </div>
  );
}
