import { renderHook } from '@testing-library/react-native';
import { Diet, Intolerance } from '#/graphql/generated/schemaTypes';
import {
  useHeldRestrictions,
  type HeldRestriction,
} from '#features/profile/hooks/useHeldRestrictions';
import { useRestrictionsNote } from '../useRestrictionsNote';

jest.mock('#features/profile/hooks/useHeldRestrictions', () => ({
  useHeldRestrictions: jest.fn(),
}));

const held = (restrictions: HeldRestriction[]) =>
  jest
    .mocked(useHeldRestrictions)
    .mockReturnValue({ restrictions, complete: true });

const diet = (value: Diet): HeldRestriction => ({
  diet: value,
  intolerance: null,
  item: null,
});
const allergen = (value: Intolerance): HeldRestriction => ({
  diet: null,
  intolerance: value,
  item: null,
});

describe('useRestrictionsNote', () => {
  // "A vegetarian with a peanut allergy"
  it('names the diet first, then what is left out', () => {
    held([allergen(Intolerance.Peanut), diet(Diet.Vegetarian)]);

    const { result } = renderHook(() => useRestrictionsNote('home-1'));

    expect(result.current).toBe('Vegetarian • No peanut');
  });

  it('names an avoided food by its catalog name', () => {
    held([
      { diet: null, intolerance: null, item: { id: 'i-1', name: 'Bacon' } },
    ]);

    const { result } = renderHook(() => useRestrictionsNote('home-1'));

    expect(result.current).toBe('No bacon');
  });

  it('counts what it has no room to name', () => {
    held([
      diet(Diet.Vegetarian),
      allergen(Intolerance.Peanut),
      allergen(Intolerance.Sesame),
      allergen(Intolerance.Soy),
      allergen(Intolerance.Egg),
    ]);

    const { result } = renderHook(() => useRestrictionsNote('home-1'));

    expect(result.current).toBe('Vegetarian • No peanut • No sesame • +2');
  });

  // "No restrictions"
  it('says nothing with no restriction held', () => {
    held([]);

    const { result } = renderHook(() => useRestrictionsNote('home-1'));

    expect(result.current).toBeNull();
  });
});
