export const SKILL_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const DIETARY_LIMITS = {
  prepTime: { min: 0, max: 480 },
  cookTime: { min: 0, max: 480 },
  budget: { min: 0, max: 1000 },
  calories: { min: 0, max: 10000 },
  protein: { min: 0, max: 500 },
  carbs: { min: 0, max: 1000 },
  fat: { min: 0, max: 500 },
} as const;
