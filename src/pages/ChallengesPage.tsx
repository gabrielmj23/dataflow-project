import { useMemo, useState } from "react";
import {
  CHALLENGE_MAP_VIEWBOX,
  listChallenges,
} from "@/challenges/definitions";
import {
  getChallengeStatuses,
  loadChallengeProgress,
} from "@/challenges/progress";
import { ChallengeMap } from "@/components/challenges/ChallengeMap";
import AppHeader from "@/components/app-header";

export default function ChallengesPage() {
  const [progress] = useState(() => loadChallengeProgress());
  const challenges = useMemo(() => listChallenges(), []);

  const statuses = useMemo(
    () => getChallengeStatuses(challenges, progress),
    [challenges, progress],
  );

  const backgroundHref = "/challenge-map.png";

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden">
      <ChallengeMap
        backgroundHref={backgroundHref}
        viewBox={CHALLENGE_MAP_VIEWBOX}
        challenges={challenges}
        statuses={statuses}
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
