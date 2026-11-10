import { useRef } from 'react';
import {
  RestrictionSeverity,
  type Diet,
  type Intolerance,
  type ReligiousDiet,
  type RestrictionKindInput,
} from '#/graphql/generated/schemaTypes';
import { generateEntityId } from '#/utils/generateEntityId';
import { isLifestyleDiet } from '#domain/dietary';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useRecordOnboardingProgress } from '#features/onboarding/store/onboardingProgressStore';

/** What the dietary step holds until Continue. */
export interface DietarySelection {
  allergens: {
    value: Intolerance;
    severity: RestrictionSeverity.Allergy | RestrictionSeverity.Intolerance;
  }[];
  /** One animal-food diet and one eating style at most (`withDietPicked`). */
  diets: Diet[];
  /** Foods to avoid, each with the severity the avoid sheet chose. */
  foods: { id: string; name: string; severity: RestrictionSeverity }[];
  /** Private to the user; null when none. */
  religiousDiet: ReligiousDiet | null;
}

interface Wanted {
  kind: RestrictionKindInput;
  severity: RestrictionSeverity;
}

const keyOf = (restriction: {
  diet?: Diet | null;
  intolerance?: Intolerance | null;
  item?: { id: string } | null;
}): string | null => {
  if (restriction.diet) return `diet:${restriction.diet}`;
  if (restriction.intolerance) return `intolerance:${restriction.intolerance}`;
  return restriction.item ? `item:${restriction.item.id}` : null;
};

function wantedOf(selection: DietarySelection): Map<string, Wanted> {
  const wanted = new Map<string, Wanted>();
  for (const { value, severity } of selection.allergens) {
    wanted.set(`intolerance:${value}`, {
      kind: { intolerance: value },
      severity,
    });
  }
  for (const diet of selection.diets) {
    wanted.set(`diet:${diet}`, {
      kind: { diet },
      severity: RestrictionSeverity.Preference,
    });
  }
  for (const food of selection.foods) {
    wanted.set(`item:${food.id}`, {
      kind: { item: food.id },
      severity: food.severity,
    });
  }
  return wanted;
}

type Allergen = DietarySelection['allergens'][number];

const isAllergenSeverity = (
  severity: RestrictionSeverity,
): severity is Allergen['severity'] =>
  severity === RestrictionSeverity.Allergy ||
  severity === RestrictionSeverity.Intolerance;

/**
 * Saves the dietary step's selection to the user's own profile on Continue:
 * adds only what the profile lacks, and removes what the user deselected of
 * what this step added or showed them. A row the step never showed (a health
 * goal, a constraint, a religious diet) is never touched.
 */
export function useDietaryIntake() {
  const {
    profile,
    editableProfile,
    updateDietaryProfile,
    addDietaryRestriction,
    removeDietaryRestriction,
  } = useDietaryProfile({ fetchPolicy: 'cache-first' });
  // Whether this step set the religious diet, so it may clear it again.
  const setReligiousDiet = useRef(false);
  const { recordDietarySaved } = useRecordOnboardingProgress();
  // Keys this step added, with the id and severity sent: only these may be
  // undone. Before the profile exists on the device, no read lists them.
  const addedRef = useRef(
    new Map<string, { id: string; severity: RestrictionSeverity }>(),
  );

  const restrictions = profile?.restrictions ?? [];
  /** What the profile already holds that the step shows; null until read. */
  const held: DietarySelection | null = editableProfile
    ? {
        allergens: restrictions.flatMap(({ intolerance, severity }) =>
          intolerance && isAllergenSeverity(severity)
            ? [{ value: intolerance, severity }]
            : [],
        ),
        diets: restrictions.flatMap(({ diet }) =>
          diet && isLifestyleDiet(diet) ? [diet] : [],
        ),
        foods: restrictions.flatMap(({ item, severity }) =>
          item ? [{ id: item.id, name: item.name, severity }] : [],
        ),
        religiousDiet: editableProfile.religiousDiet,
      }
    : null;

  /**
   * Resolves false when a write was refused; what succeeded stays saved.
   * `shown` is what the step showed as already saved: only those, and this
   * step's own adds, may be removed.
   */
  const save = async (
    selection: DietarySelection,
    shown: DietarySelection | null = null,
  ): Promise<boolean> => {
    const wanted = wantedOf(selection);
    const existing = new Map<
      string,
      { id: string; severity: RestrictionSeverity }
    >();
    for (const restriction of restrictions) {
      const key = keyOf(restriction);
      if (key) existing.set(key, restriction);
    }
    const removable = new Map(addedRef.current);
    for (const key of shown ? wantedOf(shown).keys() : []) {
      const row = existing.get(key);
      if (row) removable.set(key, row);
    }

    let ok = true;
    for (const [key, own] of removable) {
      if (wanted.get(key)?.severity === own.severity) continue;
      const id = existing.get(key)?.id ?? own.id;
      if (await removeDietaryRestriction(id)) {
        existing.delete(key);
        addedRef.current.delete(key);
      } else {
        ok = false;
      }
    }

    for (const [key, entry] of wanted) {
      if (existing.has(key) || addedRef.current.has(key)) continue;
      const id = generateEntityId();
      const added = await addDietaryRestriction(
        entry.kind,
        entry.severity,
        undefined,
        id,
      );
      if (added) {
        addedRef.current.set(key, { id, severity: entry.severity });
      } else {
        ok = false;
      }
    }

    // Set when chosen; cleared only when the step showed it or set it.
    const religiousNow = editableProfile?.religiousDiet ?? null;
    const mayClear = !!shown?.religiousDiet || setReligiousDiet.current;
    if (
      selection.religiousDiet !== religiousNow &&
      (selection.religiousDiet !== null || mayClear)
    ) {
      if (
        await updateDietaryProfile({ religiousDiet: selection.religiousDiet })
      ) {
        setReligiousDiet.current = selection.religiousDiet !== null;
      } else {
        ok = false;
      }
    }

    recordDietarySaved(
      selection.religiousDiet !== null ||
        [...wanted.keys()].some(
          key => existing.has(key) || addedRef.current.has(key),
        ),
    );
    return ok;
  };

  return { save, held };
}
