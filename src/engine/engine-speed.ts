export type EngineSpeedOption = {
  id: string;
  label: string;
  delayMs: number;
};

export const BASE_ENGINE_STEP_DELAY_MS = 50;

export const ENGINE_SPEED_OPTIONS: EngineSpeedOption[] = [
  { id: "x0.25", label: "x0.25", delayMs: 3000},
  { id: "x0.5", label: "x0.5", delayMs: 2000 },
  { id: "x0.75", label: "x0.75", delayMs: 1000 },
  { id: "x1", label: "x1", delayMs: BASE_ENGINE_STEP_DELAY_MS }
];

export const DEFAULT_ENGINE_SPEED_ID = "x1";

export function getEngineSpeedOption(id: string): EngineSpeedOption {
  return (
    ENGINE_SPEED_OPTIONS.find((option) => option.id === id) ??
    ENGINE_SPEED_OPTIONS.find((option) => option.id === DEFAULT_ENGINE_SPEED_ID) ??
    ENGINE_SPEED_OPTIONS[0]
  );
}
