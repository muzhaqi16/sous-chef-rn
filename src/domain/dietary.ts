import { CookingSkillLevel, Diet } from '#/graphql/generated/schemaTypes';

/**
 * Stackable dietary constraints — they layer on a lifestyle diet, so they stay
 * multi-select, while every other `Diet` member is mutually exclusive. One
 * source for both the recipe filter sheet and the dietary-profile selector.
 */
export const CONSTRAINT_DIETS: ReadonlySet<Diet> = new Set([
  Diet.GlutenFree,
  Diet.LowFodmap,
]);

/** True for mutually-exclusive lifestyle diets (vegan, keto, paleo, …). */
export const isLifestyleDiet = (diet: Diet): boolean =>
  !CONSTRAINT_DIETS.has(diet);

/** Least to most experienced — the picker's order, which the enum's is not. */
export const SKILL_LEVELS: readonly CookingSkillLevel[] = [
  CookingSkillLevel.Beginner,
  CookingSkillLevel.Intermediate,
  CookingSkillLevel.Advanced,
  CookingSkillLevel.Expert,
];

/**
 * A stored level this build can word. A cache persisted before the enum holds
 * the Title-case string it replaced until the profile is refetched.
 */
export const knownSkillLevel = (
  value: string | null | undefined,
): CookingSkillLevel | null =>
  SKILL_LEVELS.find(level => level === value) ?? null;

export const DIETARY_LIMITS = {
  prepTime: { min: 0, max: 480 },
  cookTime: { min: 0, max: 480 },
  budget: { min: 0, max: 1000 },
  calories: { min: 0, max: 10000 },
  protein: { min: 0, max: 500 },
  carbs: { min: 0, max: 1000 },
  fat: { min: 0, max: 500 },
};
