/**
 * Safely coerces an unknown value into a plain record.
 *
 * This is used to read `node.data` coming from the UI graph, which may be
 * `undefined`, `null`, or any other JSON value.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return (
    value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  ) as Record<string, unknown>;
}

/**
 * Type guard that checks if a value is an array with at least one element.
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}
