import { useRef } from 'react';
import {
  RestrictionSeverity,
  type Diet,
  type Intolerance,
  type RestrictionKindInput,
} from '#/graphql/generated/schemaTypes';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useRecordOnboardingProgress } from '#features/onboarding/store/onboardingProgressStore';

/** What the dietary step holds until Continue. */
export interface DietarySelection {
  allergens: {
    value: Intolerance;
    severity: RestrictionSeverity.Allergy | RestrictionSeverity.Intolerance;
  }[];
  diet: Diet | null;
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
  if (selection.diet) {
    wanted.set(`diet:${selection.diet}`, {
      kind: { diet: selection.diet },
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
  // Keys this step added, with the severity sent: only these may be undone.
  const addedRef = useRef(new Map<string, RestrictionSeverity>());

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
    for (const [key, sentSeverity] of addedRef.current) {
      const held = existing.get(key);
      const still = wanted.get(key);
      if (!held || (still && still.severity === sentSeverity)) continue;
      if (await removeDietaryRestriction(held.id)) {
        existing.delete(key);
        addedRef.current.delete(key);
      } else {
        ok = false;
      }
    }

    for (const [key, entry] of wanted) {
      if (existing.has(key)) continue;
      if (await addDietaryRestriction(entry.kind, entry.severity)) {
        addedRef.current.set(key, entry.severity);
      } else {
        ok = false;
      }
    }

    recordDietarySaved(wanted.size > 0);
    return ok;
  };

  return { save };
}
