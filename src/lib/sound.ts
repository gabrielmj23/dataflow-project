export function playPop(): void {
  try {
    const audio = new Audio("/pop.mp3");
    audio.preload = "auto";
    // Attempt to play; ignore promise rejection (autoplay policies may block until user interacts)
    void audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

export function playCorrect(): void {
  try {
    const audio = new Audio("/correct.mp3");
    audio.preload = "auto";
    void audio.play().catch(() => {});
  } catch {
    // ignore
  }
}
