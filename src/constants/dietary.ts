import { Diet } from '#/graphql/generated/schemaTypes';

/**
 * Stackable dietary constraints. These layer on top of any lifestyle diet
 * (e.g. a "gluten-free vegetarian"), so they remain multi-select. Every other
 * member of the `Diet` enum is a mutually-exclusive lifestyle diet, of which a
 * user may hold at most one. Single source of truth for both the recipe filter
 * sheet and the dietary-profile selector so the two stay in sync.
 */
export const CONSTRAINT_DIETS: ReadonlySet<Diet> = new Set([
  Diet.GlutenFree,
  Diet.LowFodmap,
]);

/** True for mutually-exclusive lifestyle diets (vegan, keto, paleo, …). */
export const isLifestyleDiet = (diet: Diet): boolean =>
  !CONSTRAINT_DIETS.has(diet);

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export const SKILL_LEVELS: SkillLevel[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
];

export const DIETARY_LIMITS = {
  prepTime: { min: 0, max: 480 },
  cookTime: { min: 0, max: 480 },
  budget: { min: 0, max: 1000 },
  calories: { min: 0, max: 10000 },
  protein: { min: 0, max: 500 },
  carbs: { min: 0, max: 1000 },
  fat: { min: 0, max: 500 },
};
