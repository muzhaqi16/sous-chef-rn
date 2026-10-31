import { act, renderHook } from '@testing-library/react-native';
import {
  Diet,
  Intolerance,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { useOnboardingProgressStore } from '#features/onboarding/store/onboardingProgressStore';
import { useDietaryIntake, type DietarySelection } from '../useDietaryIntake';

// The writes' own cache effects are useDietaryProfile's, tested there; this
// pins which writes the step sends.
type Restriction = {
  id: string;
  diet: Diet | null;
  intolerance: Intolerance | null;
  healthGoal: null;
  item: { id: string; name: string } | null;
  severity: RestrictionSeverity;
};
let mockRestrictions: Restriction[] = [];
const mockAdd = jest.fn().mockResolvedValue(true);
const mockRemove = jest.fn().mockResolvedValue(true);
jest.mock('#features/profile/hooks/useDietaryProfile', () => ({
  useDietaryProfile: () => ({
    profile: { restrictions: mockRestrictions },
    addDietaryRestriction: mockAdd,
    removeDietaryRestriction: mockRemove,
  }),
}));

const NONE: DietarySelection = { allergens: [], diet: null, foods: [] };

const held = (
  id: string,
  kind: Partial<Pick<Restriction, 'diet' | 'intolerance' | 'item'>>,
  severity: RestrictionSeverity,
): Restriction => ({
  id,
  diet: null,
  intolerance: null,
  healthGoal: null,
  item: null,
  ...kind,
  severity,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRestrictions = [];
  useOnboardingProgressStore.setState({ dietarySaved: false });
});

async function save(
  result: { current: ReturnType<typeof useDietaryIntake> },
  selection: DietarySelection,
) {
  let ok = false;
  await act(async () => {
    ok = await result.current.save(selection);
  });
  return ok;
}

describe('useDietaryIntake', () => {
  it('saves peanuts as an allergy', async () => {
    const { result } = renderHook(() => useDietaryIntake());

    await save(result, {
      ...NONE,
      allergens: [
        { value: Intolerance.Peanut, severity: RestrictionSeverity.Allergy },
      ],
    });

    expect(mockAdd).toHaveBeenCalledWith(
      { intolerance: Intolerance.Peanut },
      RestrictionSeverity.Allergy,
    );
    expect(useOnboardingProgressStore.getState().dietarySaved).toBe(true);
  });

  it('saves a food to avoid with the severity the sheet chose', async () => {
    const { result } = renderHook(() => useDietaryIntake());

    await save(result, {
      ...NONE,
      foods: [
        {
          id: 'bacon',
          name: 'Bacon',
          severity: RestrictionSeverity.Preference,
        },
        { id: 'kiwi', name: 'Kiwi', severity: RestrictionSeverity.Allergy },
      ],
    });

    expect(mockAdd).toHaveBeenCalledWith(
      { item: 'bacon' },
      RestrictionSeverity.Preference,
    );
    expect(mockAdd).toHaveBeenCalledWith(
      { item: 'kiwi' },
      RestrictionSeverity.Allergy,
    );
  });

  it('never adds a kind the profile already holds', async () => {
    mockRestrictions = [
      held(
        'r-1',
        { intolerance: Intolerance.Peanut },
        RestrictionSeverity.Allergy,
      ),
    ];
    const { result } = renderHook(() => useDietaryIntake());

    await save(result, {
      ...NONE,
      allergens: [
        { value: Intolerance.Peanut, severity: RestrictionSeverity.Allergy },
      ],
    });

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('removes what it added once the user deselects it, never what was there before', async () => {
    mockRestrictions = [
      held('r-old', { diet: Diet.Vegan }, RestrictionSeverity.Preference),
    ];
    const { result, rerender } = renderHook(() => useDietaryIntake());
    await save(result, {
      ...NONE,
      allergens: [
        { value: Intolerance.Sesame, severity: RestrictionSeverity.Allergy },
      ],
    });

    // The add landed in the profile; the user goes back and clears it.
    mockRestrictions = [
      ...mockRestrictions,
      held(
        'r-sesame',
        { intolerance: Intolerance.Sesame },
        RestrictionSeverity.Allergy,
      ),
    ];
    rerender({});
    await save(result, NONE);

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith('r-sesame');
    expect(useOnboardingProgressStore.getState().dietarySaved).toBe(false);
  });

  it('replaces its own allergy with an intolerance when switched', async () => {
    const { result, rerender } = renderHook(() => useDietaryIntake());
    await save(result, {
      ...NONE,
      allergens: [
        { value: Intolerance.Dairy, severity: RestrictionSeverity.Allergy },
      ],
    });
    mockRestrictions = [
      held(
        'r-milk',
        { intolerance: Intolerance.Dairy },
        RestrictionSeverity.Allergy,
      ),
    ];
    rerender({});

    await save(result, {
      ...NONE,
      allergens: [
        {
          value: Intolerance.Dairy,
          severity: RestrictionSeverity.Intolerance,
        },
      ],
    });

    expect(mockRemove).toHaveBeenCalledWith('r-milk');
    expect(mockAdd).toHaveBeenLastCalledWith(
      { intolerance: Intolerance.Dairy },
      RestrictionSeverity.Intolerance,
    );
  });

  it('replaces its own diet when another is chosen', async () => {
    const { result, rerender } = renderHook(() => useDietaryIntake());
    await save(result, { ...NONE, diet: Diet.Vegetarian });
    mockRestrictions = [
      held('r-veg', { diet: Diet.Vegetarian }, RestrictionSeverity.Preference),
    ];
    rerender({});

    await save(result, { ...NONE, diet: Diet.Vegan });

    expect(mockRemove).toHaveBeenCalledWith('r-veg');
    expect(mockAdd).toHaveBeenLastCalledWith(
      { diet: Diet.Vegan },
      RestrictionSeverity.Preference,
    );
  });

  it('reports a refused write', async () => {
    mockAdd.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useDietaryIntake());

    const ok = await save(result, { ...NONE, diet: Diet.Keto });

    expect(ok).toBe(false);
  });
});
