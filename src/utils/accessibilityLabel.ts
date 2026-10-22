/**
 * A row's spoken label from its visible texts, in reading order. Blank parts
 * are skipped; ", " is the pause iOS puts between a derived label's parts.
 */
export function accessibilityLabelOf(
  ...parts: ReadonlyArray<string | false | null | undefined>
): string {
  return parts
    .filter((part): part is string => !!part && part.trim() !== '')
    .join(', ');
}
