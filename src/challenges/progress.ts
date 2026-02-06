import type { ChallengeDefinition, ChallengeId } from "./challenge-registry";

export type ChallengeProgress = {
  completedIds: ChallengeId[];
};

export type ChallengeStatus = "locked" | "available" | "completed";

const STORAGE_KEY = "nodi.challengeProgress.v1";

export function loadChallengeProgress(): ChallengeProgress {
  if (typeof window === "undefined") {
    return { completedIds: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completedIds: [] };
    const parsed = JSON.parse(raw) as Partial<ChallengeProgress>;
    return {
      completedIds: Array.isArray(parsed.completedIds)
        ? (parsed.completedIds as ChallengeId[])
        : [],
    };
  } catch {
    return { completedIds: [] };
  }
}

export function saveChallengeProgress(progress: ChallengeProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function markChallengeCompleted(challengeId: ChallengeId) {
  const progress = loadChallengeProgress();
  if (progress.completedIds.includes(challengeId)) return;
  saveChallengeProgress({
    completedIds: [...progress.completedIds, challengeId],
  });
}

export function getChallengeStatuses(
  challenges: ChallengeDefinition[],
  progress: ChallengeProgress,
): Record<ChallengeId, ChallengeStatus> {
  const completed = new Set(progress.completedIds);
  const statusById: Record<ChallengeId, ChallengeStatus> = {};

  for (const challenge of challenges) {
    if (completed.has(challenge.id)) {
      statusById[challenge.id] = "completed";
      continue;
    }

    const prereqs = challenge.prerequisites ?? [];
    const isUnlocked = prereqs.every((id) => completed.has(id));
    statusById[challenge.id] = isUnlocked ? "available" : "locked";
  }

  return statusById;
}
