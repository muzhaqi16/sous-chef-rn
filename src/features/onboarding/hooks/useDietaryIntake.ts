import { useRef } from 'react';
import {
  RestrictionSeverity,
  type Diet,
  type Intolerance,
  type RestrictionKindInput,
} from '#/graphql/generated/schemaTypes';
import { generateEntityId } from '#/utils/generateEntityId';
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

/**
 * Saves the dietary step's selection to the user's own profile on Continue:
 * adds only what the profile lacks, and removes what this step added and the
 * user has since deselected. Nothing the user had before is touched.
 */
export function useDietaryIntake() {
  const { profile, addDietaryRestriction, removeDietaryRestriction } =
    useDietaryProfile({ fetchPolicy: 'cache-first' });
  const { recordDietarySaved } = useRecordOnboardingProgress();
  // Keys this step added, with the id and severity sent: only these may be
  // undone. Before the profile exists on the device, no read lists them.
  const addedRef = useRef(
    new Map<string, { id: string; severity: RestrictionSeverity }>(),
  );

  /** Resolves false when a write was refused; what succeeded stays saved. */
  const save = async (selection: DietarySelection): Promise<boolean> => {
    const wanted = wantedOf(selection);
    const existing = new Map<
      string,
      { id: string; severity: RestrictionSeverity }
    >();
    for (const restriction of profile?.restrictions ?? []) {
      const key = keyOf(restriction);
      if (key) existing.set(key, restriction);
    }

    let ok = true;
    for (const [key, added] of addedRef.current) {
      if (wanted.get(key)?.severity === added.severity) continue;
      const id = existing.get(key)?.id ?? added.id;
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

    recordDietarySaved(
      [...wanted.keys()].some(
        key => existing.has(key) || addedRef.current.has(key),
      ),
    );
    return ok;
  };

  return { save };
}
