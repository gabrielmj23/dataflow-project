import type { ChallengeDefinition, ChallengeId } from "./definitions";

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

  // Group challenges by `group` so we can apply sequential unlocking for groups
  // that have no explicit prerequisites (e.g. group-based roadmap).
  const byGroup = new Map<number, ChallengeDefinition[]>();
  for (const ch of challenges) {
    const arr = byGroup.get(ch.group) ?? [];
    arr.push(ch);
    byGroup.set(ch.group, arr);
  }

  for (const [, list] of byGroup.entries()) {
    // Sort by level to determine natural ordering within the group
    const ordered = [...list].sort((a, b) => a.level - b.level);

    // Find first non-completed challenge without prerequisites to mark available
    let firstAvailableMarked = false;

    for (const challenge of ordered) {
      if (completed.has(challenge.id)) {
        statusById[challenge.id] = "completed";
        continue;
      }

      const prereqs = challenge.prerequisites ?? [];

      if (prereqs.length > 0) {
        // Preserve original behavior for challenges with explicit prerequisites
        const isUnlocked = prereqs.every((id) => completed.has(id));
        statusById[challenge.id] = isUnlocked ? "available" : "locked";
        // If unlocked due to prerequisites, allow following items in order to be
        // potentially available (they'll be evaluated in their turn).
        if (isUnlocked) firstAvailableMarked = true;
        continue;
      }

      // No prerequisites: apply sequential unlock within this group.
      if (!firstAvailableMarked) {
        statusById[challenge.id] = "available";
        firstAvailableMarked = true;
      } else {
        statusById[challenge.id] = "locked";
      }
    }
  }

  return statusById;
}
