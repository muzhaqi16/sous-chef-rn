import { act, renderHook } from '@testing-library/react-native';
import { toastService } from '#/services/toastService';
import type { TabBarAddAction } from '#/context/TabBarActionsContext';
import { useStore } from '#store';
import { useTabBarAddMenu } from '../useTabBarAddMenu';

const mockSetAddMenu = jest.fn();
const mockSetAddMenuOpen = jest.fn();

let focusEffect: (() => (() => void) | void) | null = null;
let mockIsFocused = false;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => {
    focusEffect = cb;
  },
  useIsFocused: () => mockIsFocused,
}));

jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: () => ({
    setAddMenu: mockSetAddMenu,
    setAddMenuOpen: mockSetAddMenuOpen,
  }),
}));

// RecipeMain's stack sits inside the tab navigator, whose focused route is
// the Recipe tab.
const tabs = {
  getState: () => ({
    type: 'tab',
    index: 2,
    routes: [{ name: 'Pantry' }, { name: 'ShoppingList' }, { name: 'Recipe' }],
  }),
  getParent: () => undefined,
};
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    navigation: {
      getState: () => ({
        type: 'stack',
        index: 0,
        routes: [{ name: 'RecipeMain' }],
      }),
      getParent: () => tabs,
    },
  }),
}));

const action = (
  key: string,
  overrides: Partial<TabBarAddAction> = {},
): TabBarAddAction => ({
  key,
  label: key,
  icon: 'add',
  onPress: jest.fn(),
  ...overrides,
});

/** The actions of the latest registration for a tab. */
const registeredFor = (tab: string): readonly TabBarAddAction[] => {
  const call = mockSetAddMenu.mock.calls.filter(([t]) => t === tab).at(-1);
  return (call?.[1] ?? []) as readonly TabBarAddAction[];
};

/** The screen gains focus; returns what runs when it loses it. */
function focus(): () => void {
  mockIsFocused = true;
  let cleanup: (() => void) | void;
  act(() => {
    cleanup = focusEffect?.();
  });
  return () => {
    mockIsFocused = false;
    act(() => {
      if (typeof cleanup === 'function') cleanup();
    });
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  focusEffect = null;
  mockIsFocused = false;
});

afterEach(() => {
  useStore.setState({ pendingTabAdd: null });
});

describe('useTabBarAddMenu', () => {
  it('registers the menu under the tab holding the focused screen', () => {
    renderHook(() => useTabBarAddMenu([action('link'), action('manual')]));

    focus();

    expect(registeredFor('Recipe').map(a => a.key)).toEqual(['link', 'manual']);
  });

  it('closes the menu on blur and keeps it registered', () => {
    renderHook(() => useTabBarAddMenu([action('link'), action('manual')]));
    const blur = focus();
    mockSetAddMenu.mockClear();

    blur();

    expect(mockSetAddMenuOpen).toHaveBeenCalledWith(false);
    expect(mockSetAddMenu).not.toHaveBeenCalled();
  });

  it('removes the menu when the screen unmounts', () => {
    const { unmount } = renderHook(() =>
      useTabBarAddMenu([action('link'), action('manual')]),
    );
    focus();

    unmount();

    expect(mockSetAddMenu).toHaveBeenLastCalledWith('Recipe', undefined);
  });

  it('hands the bar the latest handler', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = renderHook(
      ({ onPress }: { onPress: () => void }) =>
        useTabBarAddMenu([action('link', { onPress }), action('manual')]),
      { initialProps: { onPress: first } },
    );
    focus();

    rerender({ onPress: latest });
    registeredFor('Recipe')[0]?.onPress();

    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('registers again when what an entry shows changes', () => {
    const { rerender } = renderHook(
      ({ reason }: { reason?: string }) =>
        useTabBarAddMenu([
          action('link', { disabledReason: reason }),
          action('manual'),
        ]),
      { initialProps: { reason: undefined as string | undefined } },
    );
    focus();

    rerender({ reason: 'Needs a connection' });

    expect(registeredFor('Recipe')[0]?.disabledReason).toBe(
      'Needs a connection',
    );
  });

  describe('an add another tab asked for', () => {
    const handOver = (actionKey?: string) =>
      useStore
        .getState()
        .setPendingTabAdd({ tab: 'Recipe', ...(actionKey && { actionKey }) });

    it('runs the action it names when the tab gains focus', () => {
      const link = action('link');
      const manual = action('manual');
      handOver('manual');
      renderHook(() => useTabBarAddMenu([link, manual]));

      focus();

      expect(manual.onPress).toHaveBeenCalledTimes(1);
      expect(link.onPress).not.toHaveBeenCalled();
      expect(useStore.getState().pendingTabAdd).toBeNull();
    });

    it('runs the only action when it names none', () => {
      const only = action('add');
      handOver();
      renderHook(() => useTabBarAddMenu([only]));

      focus();

      expect(only.onPress).toHaveBeenCalledTimes(1);
    });

    it('opens the menu when it names none and there are several', () => {
      const link = action('link');
      handOver();
      renderHook(() => useTabBarAddMenu([link, action('manual')]));

      focus();

      expect(mockSetAddMenuOpen).toHaveBeenCalledWith(true);
      expect(link.onPress).not.toHaveBeenCalled();
    });

    // The menu shows the reason the add cannot run.
    it('opens the menu instead of running a disabled action', () => {
      const manual = action('manual', { disabledReason: 'Read-only list' });
      handOver('manual');
      renderHook(() => useTabBarAddMenu([action('link'), manual]));

      focus();

      expect(manual.onPress).not.toHaveBeenCalled();
      expect(mockSetAddMenuOpen).toHaveBeenCalledWith(true);
    });

    // The bar draws no menu for one action, so an open one would show nothing.
    it("says a lone disabled action's reason rather than opening a menu", () => {
      const meal = action('meal', {
        disabledReason: 'Create a meal plan first',
      });
      handOver('meal');
      renderHook(() => useTabBarAddMenu([meal]));

      focus();

      expect(meal.onPress).not.toHaveBeenCalled();
      expect(toastService.info).toHaveBeenCalledWith(
        'Create a meal plan first',
      );
      expect(mockSetAddMenuOpen).not.toHaveBeenCalledWith(true);
    });

    it('opens no menu for a tab with no actions', () => {
      handOver('meal');
      renderHook(() => useTabBarAddMenu([]));

      focus();

      expect(mockSetAddMenuOpen).not.toHaveBeenCalledWith(true);
      expect(useStore.getState().pendingTabAdd).toBeNull();
    });

    it("drops another tab's add without running anything", () => {
      const link = action('link');
      useStore.getState().setPendingTabAdd({ tab: 'Pantry' });
      renderHook(() => useTabBarAddMenu([link]));

      focus();

      expect(link.onPress).not.toHaveBeenCalled();
      expect(mockSetAddMenuOpen).not.toHaveBeenCalledWith(true);
      expect(useStore.getState().pendingTabAdd).toBeNull();
    });

    it('starts it once, however often the actions change after', () => {
      const onPress = jest.fn();
      handOver('add');
      const { rerender } = renderHook(
        ({ label }: { label: string }) =>
          useTabBarAddMenu([action('add', { label, onPress })]),
        { initialProps: { label: 'Add' } },
      );
      focus();

      rerender({ label: 'Add item' });

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    describe('naming an action still loading', () => {
      const loading = { disabledReason: 'Loading', pending: true };

      it('runs it once it can, with no menu in between', () => {
        const onPress = jest.fn();
        handOver('search');
        const { rerender } = renderHook(
          ({ ready }: { ready: boolean }) =>
            useTabBarAddMenu([
              action('search', { onPress, ...(!ready && loading) }),
              action('manual', ready ? {} : loading),
            ]),
          { initialProps: { ready: false } },
        );
        focus();
        expect(onPress).not.toHaveBeenCalled();
        expect(mockSetAddMenuOpen).not.toHaveBeenCalledWith(true);
        expect(toastService.info).not.toHaveBeenCalled();

        rerender({ ready: true });

        expect(onPress).toHaveBeenCalledTimes(1);
        expect(mockSetAddMenuOpen).not.toHaveBeenCalledWith(true);
        expect(useStore.getState().pendingTabAdd).toBeNull();
      });

      it('says why once loading ends in a refusal', () => {
        handOver('search');
        const { rerender } = renderHook(
          ({ ready }: { ready: boolean }) =>
            useTabBarAddMenu([
              action(
                'search',
                ready ? { disabledReason: 'No permission' } : loading,
              ),
            ]),
          { initialProps: { ready: false } },
        );
        focus();

        rerender({ ready: true });

        expect(toastService.info).toHaveBeenCalledWith('No permission');
      });

      it('drops it when the tab loses focus first', () => {
        const onPress = jest.fn();
        handOver('search');
        const { rerender } = renderHook(
          ({ ready }: { ready: boolean }) =>
            useTabBarAddMenu([
              action('search', { onPress, ...(!ready && loading) }),
            ]),
          { initialProps: { ready: false } },
        );
        const blur = focus();
        blur();

        rerender({ ready: true });

        expect(onPress).not.toHaveBeenCalled();
        expect(useStore.getState().pendingTabAdd).toBeNull();
      });
    });
  });
});
