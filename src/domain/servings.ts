/** The most people an account can say it cooks for, as the API bounds it. */
export const COOKS_FOR_MAX = 20;

/** A family is three or more; the count it starts at. */
export const FAMILY_MIN = 3;
export const FAMILY_DEFAULT = 4;

/**
 * Where servings start: who the user cooks for, else the fallback (a recipe's
 * own servings, or a plan's default). What the user then chooses is kept.
 */
export const startingServings = (
  cooksFor: number | null | undefined,
  fallback: number,
): number => cooksFor ?? fallback;
