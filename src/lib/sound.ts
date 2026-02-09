const LOCAL_KEY = "df:sounds-enabled";

export function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw === null) return true; // default on
    return raw === "1";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LOCAL_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

export function toggleSoundEnabled(): boolean {
  const next = !isSoundEnabled();
  setSoundEnabled(next);
  return next;
}

export function playPop(): void {
  if (!isSoundEnabled()) return;
  try {
    const audio = new Audio("/pop.mp3");
    audio.preload = "auto";
    void audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function playCorrect(): void {
  if (!isSoundEnabled()) return;
  try {
    const audio = new Audio("/correct.mp3");
    audio.preload = "auto";
    void audio.play().catch(() => {});
  } catch {
    // ignore
  }
}
