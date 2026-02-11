import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { playCorrect } from "@/lib/sound";
import {
  loadChallengeProgress,
  saveChallengeProgress,
  type ChallengeProgress,
} from "@/challenges/progress";
import type { ChallengeId } from "@/challenges/definitions";

export type ChallengeProgressContextValue = {
  progress: ChallengeProgress;
  markCompleted: (id: ChallengeId) => void;
  resetProgress: () => void;
};

const ChallengeProgressContext =
  createContext<ChallengeProgressContextValue | null>(null);

export function ChallengeProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [progress, setProgress] = useState<ChallengeProgress>(() =>
    loadChallengeProgress(),
  );

  useEffect(() => {
    saveChallengeProgress(progress);
  }, [progress]);

  const markCompleted = useCallback((id: ChallengeId) => {
    setProgress((prev) => {
      if (prev.completedIds.includes(id)) return prev;
      const next = { completedIds: [...prev.completedIds, id] };
      // Play success sound for newly completed challenge
      try {
        playCorrect();
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({ completedIds: [] });
  }, []);

  const value = useMemo(
    () => ({ progress, markCompleted, resetProgress }),
    [progress, markCompleted, resetProgress],
  );

  return (
    <ChallengeProgressContext.Provider value={value}>
      {children}
    </ChallengeProgressContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChallengeProgress(): ChallengeProgressContextValue {
  const context = useContext(ChallengeProgressContext);
  if (!context) {
    throw new Error(
      "useChallengeProgress must be used within ChallengeProgressProvider.",
    );
  }
  return context;
}
