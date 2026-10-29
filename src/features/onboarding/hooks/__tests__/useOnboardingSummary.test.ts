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
      pantryItems: false,
      invites: false,
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

  it('says pantry items were added and invitations sent only once recorded', () => {
    const { result } = renderHook(() => useOnboardingSummary());
    act(() => useOnboardingProgressStore.getState().recordPantryItemsAdded());
    expect(result.current).toMatchObject({ pantryItems: true, invites: false });
    act(() => useOnboardingProgressStore.getState().recordInvitesSent());
    expect(result.current.invites).toBe(true);
  });
});
