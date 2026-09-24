export function normalizeSubflowName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function resolvePreviousLabelForGlobalUpdate(params: {
  mode: "local" | "global";
  currentLabel: string;
  previousLabel: string | null;
}): string {
  if (params.mode !== "global") {
    return params.currentLabel;
  }

  return params.previousLabel ?? params.currentLabel;
}
