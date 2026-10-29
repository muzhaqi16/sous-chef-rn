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
  { labelKey: 'labels.vegetarian', value: Diet.Vegetarian },
  { labelKey: 'labels.vegan', value: Diet.Vegan },
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
    labelKey: 'labels.sulfite',
    value: Intolerance.Sulfite,
  },
  {
    labelKey: 'recipes.intolerance.TREE_NUT',
    value: Intolerance.TreeNut,
  },
  { labelKey: 'recipes.intolerance.WHEAT', value: Intolerance.Wheat },
  { labelKey: 'recipes.intolerance.FISH', value: Intolerance.Fish },
];

/** The nine major US food allergens, in the order an allergy picker leads with. */
const MAJOR_US_ALLERGENS: readonly Intolerance[] = [
  Intolerance.Dairy,
  Intolerance.Egg,
  Intolerance.Fish,
  Intolerance.Shellfish,
  Intolerance.TreeNut,
  Intolerance.Peanut,
  Intolerance.Wheat,
  Intolerance.Soy,
  Intolerance.Sesame,
];

/** Every allergy and intolerance option, the nine major US allergens first. */
export const INTOLERANCE_OPTIONS_MAJOR_FIRST: readonly DietaryOption<Intolerance>[] =
  [
    ...MAJOR_US_ALLERGENS.flatMap(value =>
      INTOLERANCE_OPTIONS.filter(option => option.value === value),
    ),
    ...INTOLERANCE_OPTIONS.filter(
      option => !MAJOR_US_ALLERGENS.includes(option.value),
    ),
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

/** Whether a restriction can flag a product or recipe: a health goal never does. */
export const canAlert = (restriction: {
  diet?: Diet | null;
  intolerance?: Intolerance | null;
  item?: { id: string } | null;
}): boolean =>
  !!restriction.diet || !!restriction.intolerance || !!restriction.item;

/** An allergy or intolerance reads as a warning; a preference or goal, a note. */
export const isStrictSeverity = (severity: RestrictionSeverity): boolean =>
  severity === RestrictionSeverity.Allergy ||
  severity === RestrictionSeverity.Intolerance;

/** Why an alert applies, "contains peanut" or for a diet "not vegan", under the member's name. */
export function householdAlertReasonKey(alert: HouseholdAlert): TranslationKey {
  const contains = alert.state === DietaryAlertState.Contains;
  if (alert.isDiet) {
    return contains
      ? 'dietaryAlerts.reason.notDiet'
      : 'dietaryAlerts.reason.mayNotDiet';
  }
  return contains
    ? 'dietaryAlerts.reason.contains'
    : 'dietaryAlerts.reason.mayContain';
}

/** The word a severity goes by, as the profile's avoid picker offers it; a goal has none. */
export const SEVERITY_LABEL_KEYS: Partial<
  Record<RestrictionSeverity, TranslationKey>
> = {
  [RestrictionSeverity.Preference]: 'dietaryProfile.avoidSeverity.preference',
  [RestrictionSeverity.Intolerance]: 'dietaryProfile.avoidSeverity.intolerance',
  [RestrictionSeverity.Allergy]: 'dietaryProfile.avoidSeverity.allergy',
};

/** The severity word an alert shows; a diet's reason ("not vegan") says it alone. */
export const alertSeverityLabelKey = (
  alert: HouseholdAlert,
): TranslationKey | undefined =>
  alert.isDiet ? undefined : SEVERITY_LABEL_KEYS[alert.severity];

// Partial: the wire can carry a severity this build's enum predates.
const SEVERITY_RANK: Partial<Record<RestrictionSeverity, number>> = {
  [RestrictionSeverity.Allergy]: 0,
  [RestrictionSeverity.Intolerance]: 1,
  [RestrictionSeverity.Preference]: 2,
  [RestrictionSeverity.Goal]: 3,
};
const UNRANKED = 4;

const rankOf = (alert: HouseholdAlert): number =>
  (SEVERITY_RANK[alert.severity] ?? UNRANKED) * 2 +
  (alert.state === DietaryAlertState.Contains ? 0 : 1);

/** Most serious first: an allergy before an avoided food, "contains" before "may contain". */
export const strictestFirst = (
  alerts: readonly HouseholdAlert[],
): HouseholdAlert[] => [...alerts].sort((a, b) => rankOf(a) - rankOf(b));

/**
 * - `checked`: showing the server's answer, its refresh not failed.
 * - `stale`: showing an earlier answer, offline or after a failed refresh.
 * - `unchecked`: offline with no earlier answer; never shown as "nothing found".
 * - `failed`: online, but the server gave no answer; never "nothing found".
 * - `loading`: the first answer is on its way.
 * - `none`: no home to check against.
 */
export type HouseholdCheck =
  | 'checked'
  | 'stale'
  | 'unchecked'
  | 'failed'
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
  if (answered) return offline || failed ? 'stale' : 'checked';
  if (offline) return 'unchecked';
  if (loading && !failed) return 'loading';
  return 'failed';
}
