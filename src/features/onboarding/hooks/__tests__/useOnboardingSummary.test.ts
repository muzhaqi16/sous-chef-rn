import { act, renderHook } from '@testing-library/react-native';
import { useStore } from '#store';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
} from '#features/onboarding/store/onboardingProgressStore';
import { useOnboardingSummary } from '../useOnboardingSummary';

const select = (
  homeId: string | null,
  pantryId: string | null,
  listId: string | null,
) =>
  act(() => {
    const store = useStore.getState();
    store.setSelectedHomeId(homeId);
    store.setSelectedPantryId(pantryId);
    store.setSelectedShoppingListId(listId);
  });

beforeEach(() => {
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
  select(null, null, null);
});

describe('useOnboardingSummary', () => {
  it('claims nothing before any step completes', () => {
    const { result } = renderHook(() => useOnboardingSummary());
    expect(result.current).toEqual({
      homeAndPantry: false,
      shoppingList: false,
      cooksFor: null,
      dietarySaved: false,
      receiptItems: 0,
      stapleItems: 0,
    });
  });

  it('reads a home with its pantry, and a list, from the selection', () => {
    select('home-1', 'pantry-1', 'list-1');
    const { result } = renderHook(() => useOnboardingSummary());
    expect(result.current).toMatchObject({
      homeAndPantry: true,
      shoppingList: true,
    });
  });

  it('does not claim a home without its pantry', () => {
    select('home-1', null, null);
    const { result } = renderHook(() => useOnboardingSummary());
    expect(result.current.homeAndPantry).toBe(false);
  });

  it("reads each step's result as the steps record it", () => {
    const { result } = renderHook(() => useOnboardingSummary());
    act(() => {
      const progress = useOnboardingProgressStore.getState();
      progress.recordCooksFor(2);
      progress.recordDietarySaved(true);
      progress.recordReceiptItems(4);
      progress.recordReceiptItems(3);
      progress.recordStapleItems(5);
    });
    expect(result.current).toMatchObject({
      cooksFor: 2,
      dietarySaved: true,
      receiptItems: 7,
      stapleItems: 5,
    });
  });
});
