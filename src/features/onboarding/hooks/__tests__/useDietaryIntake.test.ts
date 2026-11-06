import { act, renderHook } from '@testing-library/react-native';
import {
  Diet,
  ReligiousDiet,
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
const mockUpdate = jest.fn().mockResolvedValue(true);
let mockReligiousDiet: ReligiousDiet | null = null;
jest.mock('#features/profile/hooks/useDietaryProfile', () => ({
  useDietaryProfile: () => ({
    profile: { restrictions: mockRestrictions },
    editableProfile: {
      restrictions: mockRestrictions,
      religiousDiet: mockReligiousDiet,
    },
    updateDietaryProfile: mockUpdate,
    addDietaryRestriction: mockAdd,
    removeDietaryRestriction: mockRemove,
  }),
}));

const NONE: DietarySelection = {
  allergens: [],
  diets: [],
  foods: [],
  religiousDiet: null,
};

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
  shown: DietarySelection | null = null,
) {
  let ok = false;
  await act(async () => {
    ok = await result.current.save(selection, shown);
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
      undefined,
      expect.any(String),
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
      undefined,
      expect.any(String),
    );
    expect(mockAdd).toHaveBeenCalledWith(
      { item: 'kiwi' },
      RestrictionSeverity.Allergy,
      undefined,
      expect.any(String),
    );
  });

  it('sends nothing twice, and undoes by its own id, before the profile lists a row', async () => {
    const { result } = renderHook(() => useDietaryIntake());
    const peanut: DietarySelection = {
      ...NONE,
      allergens: [
        { value: Intolerance.Peanut, severity: RestrictionSeverity.Allergy },
      ],
    };

    await save(result, peanut);
    await save(result, peanut);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();

    await save(result, NONE);
    expect(mockRemove).toHaveBeenCalledWith(mockAdd.mock.calls[0]?.[3]);
  });

  it('claims nothing saved when every add was refused', async () => {
    mockAdd.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useDietaryIntake());

    await save(result, {
      ...NONE,
      allergens: [
        { value: Intolerance.Peanut, severity: RestrictionSeverity.Allergy },
      ],
    });

    expect(useOnboardingProgressStore.getState().dietarySaved).toBe(false);
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

  it('removes a saved answer the step showed and the user deselected', async () => {
    mockRestrictions = [
      held('r-veg', { diet: Diet.Vegetarian }, RestrictionSeverity.Preference),
      held('r-goal', { diet: Diet.GlutenFree }, RestrictionSeverity.Preference),
    ];
    const { result } = renderHook(() => useDietaryIntake());
    const shown = result.current.held;
    expect(shown?.diets).toEqual([Diet.Vegetarian]);

    await save(result, NONE, shown);

    // The constraint was never shown, so it stays.
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith('r-veg');
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
      undefined,
      expect.any(String),
    );
  });

  it('replaces its own diet when another is chosen', async () => {
    const { result, rerender } = renderHook(() => useDietaryIntake());
    await save(result, { ...NONE, diets: [Diet.Vegetarian] });
    mockRestrictions = [
      held('r-veg', { diet: Diet.Vegetarian }, RestrictionSeverity.Preference),
    ];
    rerender({});

    await save(result, { ...NONE, diets: [Diet.Vegan] });

    expect(mockRemove).toHaveBeenCalledWith('r-veg');
    expect(mockAdd).toHaveBeenLastCalledWith(
      { diet: Diet.Vegan },
      RestrictionSeverity.Preference,
      undefined,
      expect.any(String),
    );
  });

  it('saves an eating style beside an animal-food diet', async () => {
    const { result } = renderHook(() => useDietaryIntake());

    await save(result, { ...NONE, diets: [Diet.Vegetarian, Diet.Keto] });

    for (const diet of [Diet.Vegetarian, Diet.Keto]) {
      expect(mockAdd).toHaveBeenCalledWith(
        { diet },
        RestrictionSeverity.Preference,
        undefined,
        expect.any(String),
      );
    }
  });

  it('saves a religious diet to the profile', async () => {
    const { result } = renderHook(() => useDietaryIntake());

    await save(result, { ...NONE, religiousDiet: ReligiousDiet.Halal });

    expect(mockUpdate).toHaveBeenCalledWith({
      religiousDiet: ReligiousDiet.Halal,
    });
  });

  it('clears a religious diet only when the step showed it', async () => {
    mockReligiousDiet = ReligiousDiet.Kosher;
    const { result } = renderHook(() => useDietaryIntake());

    // Not shown (the profile had not loaded): left alone.
    await save(result, NONE);
    expect(mockUpdate).not.toHaveBeenCalled();

    // Shown and deselected: cleared.
    await save(result, NONE, { ...NONE, religiousDiet: ReligiousDiet.Kosher });
    expect(mockUpdate).toHaveBeenCalledWith({ religiousDiet: null });
    mockReligiousDiet = null;
  });

  it('reports a refused write', async () => {
    mockAdd.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useDietaryIntake());

    const ok = await save(result, { ...NONE, diets: [Diet.Keto] });

    expect(ok).toBe(false);
  });
});
