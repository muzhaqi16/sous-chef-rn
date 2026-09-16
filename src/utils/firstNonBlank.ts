/**
 * The first value holding visible text. `''` and whitespace-only strings count
 * as missing, which `??` does not: a display name the server accepts blank
 * must still fall through to the next choice.
 */
export function firstNonBlank(
  ...values: ReadonlyArray<string | null | undefined>
): string | undefined {
  return values.find(
    (value): value is string => value != null && value.trim() !== '',
  );
}
