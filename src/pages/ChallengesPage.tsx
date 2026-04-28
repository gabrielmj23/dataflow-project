import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  CHALLENGE_MAP_VIEWBOX,
  getChallengesByGroup,
  listChallenges,
} from "@/challenges/definitions";
import { getChallengeStatuses } from "@/challenges/progress";
import { useChallengeProgress } from "@/challenges/progress-context";
import { ChallengeMap } from "@/components/challenges/ChallengeMap";
import AppHeader from "@/components/app-header";

export default function ChallengesPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { progress } = useChallengeProgress();

  const challenges = useMemo(() => {
    const g = parseInt(groupId || "1");
    if (g === 1 || g === 2) {
      return getChallengesByGroup(g);
    }
    return listChallenges();
  }, [groupId]);

  const statuses = useMemo(
    () => getChallengeStatuses(challenges, progress),
    [challenges, progress],
  );

  const initialSelectedId = useMemo(() => {
    const unlocked = challenges.filter(
      (challenge) => (statuses[challenge.id] ?? "locked") !== "locked",
    );
    if (!unlocked.length) return null;
    const sorted = [...unlocked].sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group;
      return a.level - b.level;
    });
    return sorted[sorted.length - 1].id;
  }, [challenges, statuses]);


  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden">
      <ChallengeMap
        viewBox={CHALLENGE_MAP_VIEWBOX}
        challenges={challenges}
        statuses={statuses}
        initialSelectedId={initialSelectedId}
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
