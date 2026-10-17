import { renderHook } from '@testing-library/react-native';
import type { TabBarAddAction } from '#/context/TabBarActionsContext';
import { useTabBarAddMenu } from '../useTabBarAddMenu';

const mockSetAddMenu = jest.fn();
const mockSetAddMenuOpen = jest.fn();

let focusEffect: (() => (() => void) | void) | null = null;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => {
    focusEffect = cb;
  },
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

beforeEach(() => {
  jest.clearAllMocks();
  focusEffect = null;
});

describe('useTabBarAddMenu', () => {
  it('registers the menu under the tab holding the focused screen', () => {
    renderHook(() => useTabBarAddMenu([action('link'), action('manual')]));

    focusEffect?.();

    expect(registeredFor('Recipe').map(a => a.key)).toEqual(['link', 'manual']);
  });

  it('closes the menu on blur and keeps it registered', () => {
    renderHook(() => useTabBarAddMenu([action('link'), action('manual')]));
    const cleanup = focusEffect?.();
    mockSetAddMenu.mockClear();

    if (typeof cleanup === 'function') cleanup();

    expect(mockSetAddMenuOpen).toHaveBeenCalledWith(false);
    expect(mockSetAddMenu).not.toHaveBeenCalled();
  });

  it('removes the menu when the screen unmounts', () => {
    const { unmount } = renderHook(() =>
      useTabBarAddMenu([action('link'), action('manual')]),
    );
    focusEffect?.();

    unmount();

    expect(mockSetAddMenu).toHaveBeenLastCalledWith('Recipe', undefined);
  });

  it('runs the latest handler without registering again for it', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = renderHook(
      ({ onPress }: { onPress: () => void }) =>
        useTabBarAddMenu([action('link', { onPress }), action('manual')]),
      { initialProps: { onPress: first } },
    );
    focusEffect?.();
    const registrations = mockSetAddMenu.mock.calls.length;

    rerender({ onPress: latest });
    registeredFor('Recipe')[0]?.onPress();

    expect(mockSetAddMenu.mock.calls.length).toBe(registrations);
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
    focusEffect?.();

    rerender({ reason: 'Needs a connection' });

    expect(registeredFor('Recipe')[0]?.disabledReason).toBe(
      'Needs a connection',
    );
  });
});
