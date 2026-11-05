import { useTranslation } from '#/i18n';
import { restrictionLabel } from '#domain/dietary';
import { useHeldRestrictions } from '#features/profile/hooks/useHeldRestrictions';

/** The restrictions named before the rest are counted. */
const NAMED = 3;

/**
 * What pantry suggestions honor, worded for the note above them, such as
 * "Vegetarian • No peanut": diets first, a religious diet among them, then
 * what is left out. Null when no restriction is held, or none is known yet.
 */
export function useRestrictionsNote(
  homeId: string | null | undefined,
): string | null {
  const { t, i18n } = useTranslation();
  const { restrictions } = useHeldRestrictions(homeId);
  if (restrictions.length === 0) return null;

  const isDiet = (restriction: (typeof restrictions)[number]) =>
    !!restriction.diet || !!restriction.religiousDiet;
  const diets = restrictions.filter(isDiet);
  const avoided = restrictions.filter(restriction => !isDiet(restriction));
  const parts = [
    ...diets.map(restriction => restrictionLabel(restriction, t)),
    ...avoided.map(restriction =>
      t('recipes.restrictionsNoteWithout', {
        what: restrictionLabel(restriction, t).toLocaleLowerCase(i18n.language),
      }),
    ),
  ];
  const named = parts.slice(0, NAMED);
  const rest = parts.length - named.length;
  return [
    ...named,
    ...(rest > 0 ? [t('recipes.restrictionsNoteMore', { number: rest })] : []),
  ].join(' • ');
}
