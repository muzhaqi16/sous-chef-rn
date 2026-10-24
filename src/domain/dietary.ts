import type { TranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';
import {
  CookingSkillLevel,
  Diet,
  DietaryAlertState,
  HealthGoal,
  Intolerance,
  RestrictionSeverity,
  type MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { getMemberDisplayName } from '#/utils/formatters/memberFormatters';

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

/** A restriction value and the copy key that names it, in the pickers' order. */
export interface DietaryOption<T extends string> {
  labelKey: TranslationKey;
  value: T;
}

// Lifestyle dietary choices. Labels are i18n keys resolved via `t()` at render —
// the enum value stays the stable identity used for selection and persistence.
export const DIET_OPTIONS: readonly DietaryOption<Diet>[] = [
  { labelKey: 'dietaryProfile.diets.vegetarian', value: Diet.Vegetarian },
  { labelKey: 'dietaryProfile.diets.vegan', value: Diet.Vegan },
  { labelKey: 'recipes.diet.GLUTEN_FREE', value: Diet.GlutenFree },
  { labelKey: 'recipes.diet.KETO', value: Diet.Keto },
  { labelKey: 'recipes.diet.PALEO', value: Diet.Paleo },
  { labelKey: 'dietaryProfile.diets.pescetarian', value: Diet.Pescetarian },
  {
    labelKey: 'dietaryProfile.diets.lactoVegetarian',
    value: Diet.LactoVegetarian,
  },
  { labelKey: 'dietaryProfile.diets.ovoVegetarian', value: Diet.OvoVegetarian },
  { labelKey: 'dietaryProfile.diets.primal', value: Diet.Primal },
  { labelKey: 'labels.lowFodmap', value: Diet.LowFodmap },
  { labelKey: 'recipes.diet.WHOLE30', value: Diet.Whole30 },
];

// Allergies and intolerances
export const INTOLERANCE_OPTIONS: readonly DietaryOption<Intolerance>[] = [
  { labelKey: 'recipes.intolerance.DAIRY', value: Intolerance.Dairy },
  { labelKey: 'dietaryProfile.intolerances.egg', value: Intolerance.Egg },
  { labelKey: 'recipes.intolerance.GLUTEN', value: Intolerance.Gluten },
  { labelKey: 'recipes.intolerance.GRAIN', value: Intolerance.Grain },
  { labelKey: 'recipes.intolerance.PEANUT', value: Intolerance.Peanut },
  {
    labelKey: 'recipes.intolerance.SEAFOOD',
    value: Intolerance.Seafood,
  },
  { labelKey: 'recipes.intolerance.SESAME', value: Intolerance.Sesame },
  {
    labelKey: 'recipes.intolerance.SHELLFISH',
    value: Intolerance.Shellfish,
  },
  { labelKey: 'recipes.intolerance.SOY', value: Intolerance.Soy },
  {
    labelKey: 'dietaryProfile.intolerances.sulfite',
    value: Intolerance.Sulfite,
  },
  {
    labelKey: 'recipes.intolerance.TREE_NUT',
    value: Intolerance.TreeNut,
  },
  { labelKey: 'recipes.intolerance.WHEAT', value: Intolerance.Wheat },
  { labelKey: 'recipes.intolerance.FISH', value: Intolerance.Fish },
];

// Nutritional objectives
export const HEALTH_GOAL_OPTIONS: readonly DietaryOption<HealthGoal>[] = [
  { labelKey: 'recipes.healthGoal.LOW_CARB', value: HealthGoal.LowCarb },
  {
    labelKey: 'recipes.healthGoal.HIGH_PROTEIN',
    value: HealthGoal.HighProtein,
  },
  { labelKey: 'recipes.healthGoal.LOW_SODIUM', value: HealthGoal.LowSodium },
  { labelKey: 'recipes.healthGoal.SUGAR_FREE', value: HealthGoal.SugarFree },
  {
    labelKey: 'recipes.healthGoal.DIABETIC_FRIENDLY',
    value: HealthGoal.DiabeticFriendly,
  },
  {
    labelKey: 'recipes.healthGoal.HEART_HEALTHY',
    value: HealthGoal.HeartHealthy,
  },
];

/**
 * The copy key naming what a restriction restricts. A value this build's enum
 * does not list yet reads as unknown, never raw.
 */
export function restrictionLabelKey(restriction: {
  diet?: Diet | null;
  intolerance?: Intolerance | null;
  healthGoal?: HealthGoal | null;
}): TranslationKey {
  const { diet, intolerance, healthGoal } = restriction;
  const match = diet
    ? DIET_OPTIONS.find(option => option.value === diet)
    : intolerance
    ? INTOLERANCE_OPTIONS.find(option => option.value === intolerance)
    : healthGoal
    ? HEALTH_GOAL_OPTIONS.find(option => option.value === healthGoal)
    : undefined;
  return match ? match.labelKey : 'labels.unknown';
}

/** How a restriction reads: an avoided item by its catalog name, else its label. */
export function restrictionLabel(
  restriction: Parameters<typeof restrictionLabelKey>[0] & {
    item?: { name: string } | null;
  },
  t: (key: TranslationKey) => string,
): string {
  return restriction.item?.name ?? t(restrictionLabelKey(restriction));
}

/** One member restriction a product or ingredient meets, worded to show. */
export interface HouseholdAlert {
  /** The restriction's id: one alert per restriction. */
  id: string;
  /** The member's name in the home; "You" for the user. */
  memberName: string;
  /** What the restriction restricts, as the user's language words it. */
  what: string;
  state: DietaryAlertState;
  severity: RestrictionSeverity;
  /** A diet reads "not vegan", where the others read "contains peanut". */
  isDiet: boolean;
}

/** An alert as the API answers it, less what the app never shows. */
interface AlertFromServer {
  state: DietaryAlertState;
  membership: {
    id: string;
    userId: string;
    role: MembershipRole;
    displayName: string | null;
  };
  restriction: Parameters<typeof restrictionLabel>[0] & {
    id: string;
    severity: RestrictionSeverity;
  };
}

/**
 * Words an alert from its restriction, never from the server's `matched`
 * evidence, which is English or an enum.
 */
export function toHouseholdAlert(
  { state, membership, restriction }: AlertFromServer,
  t: Translate,
  currentUserId: string | undefined,
): HouseholdAlert {
  return {
    id: restriction.id,
    memberName: getMemberDisplayName(
      {
        id: membership.id,
        role: membership.role,
        displayName: membership.displayName,
        user: { id: membership.userId },
      },
      t,
      currentUserId,
    ),
    what: restrictionLabel(restriction, t),
    state,
    severity: restriction.severity,
    isDiet: !!restriction.diet,
  };
}

/** An allergy or intolerance reads as a warning; a preference or goal, a note. */
export const isStrictSeverity = (severity: RestrictionSeverity): boolean =>
  severity === RestrictionSeverity.Allergy ||
  severity === RestrictionSeverity.Intolerance;

/** "Ana: contains peanut", or for a diet "Sam: not vegan"; may-contain softer. */
export function householdAlertKey(alert: HouseholdAlert): TranslationKey {
  const contains = alert.state === DietaryAlertState.Contains;
  if (alert.isDiet) {
    return contains ? 'dietaryAlerts.notDiet' : 'dietaryAlerts.mayNotDiet';
  }
  return contains ? 'dietaryAlerts.contains' : 'dietaryAlerts.mayContain';
}

/**
 * - `checked`: the server answered just now.
 * - `stale`: offline, showing the answer received earlier.
 * - `unchecked`: offline with no earlier answer; never shown as "nothing found".
 * - `loading`: the first answer is on its way.
 * - `none`: no home to check against.
 */
export type HouseholdCheck =
  | 'checked'
  | 'stale'
  | 'unchecked'
  | 'loading'
  | 'none';

export function householdCheckOf({
  hasHome,
  answered,
  offline,
  failed,
  loading,
}: {
  hasHome: boolean;
  answered: boolean;
  offline: boolean;
  failed: boolean;
  loading: boolean;
}): HouseholdCheck {
  if (!hasHome) return 'none';
  if (answered) return offline ? 'stale' : 'checked';
  if (loading && !offline && !failed) return 'loading';
  return 'unchecked';
}
