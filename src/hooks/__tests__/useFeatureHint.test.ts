import { renderHook, act } from '@testing-library/react-native';
import { useFeatureHint } from '../useFeatureHint';

// Mock MMKV storage — the Map lives inside the factory so it is available
// when module-level code (ApolloCachePersistence, zustand persist) runs,
// since jest.mock factories are hoisted above variable declarations.
jest.mock('#/storage/mmkv', () => {
  const store = new Map<string, any>();
  return {
    __mockStore: store,
    storage: {
      getString: (key: string) => store.get(key),
      getNumber: (key: string) => store.get(key),
      getBoolean: (key: string) => store.get(key),
      set: (key: string, value: any) => store.set(key, value),
      remove: (key: string) => store.delete(key),
      delete: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
      getAllKeys: () => [...store.keys()],
    },
    zustandStorage: {
      getItem: async (name: string) => store.get(name) ?? null,
      setItem: async (name: string, value: string) => store.set(name, value),
      removeItem: async (name: string) => store.delete(name),
    },
    getStorage: async () => ({}),
    STORAGE_KEY: 'sous-chef-storage',
  };
});

const { __mockStore: mockStore } = jest.requireMock<{
  __mockStore: Map<string, any>;
}>('#/storage/mmkv');

// Mock tutorials setting — enabled by default
let mockTutorialsEnabled = true;
jest.mock('#hooks/settings/useSettings', () => ({
  useShowTutorials: () => mockTutorialsEnabled,
}));

// Mock user store
let mockUserId: string | undefined = 'user-1';
jest.mock('#store/useAppStore', () => {
  const getState = () => ({
    user: mockUserId ? { id: mockUserId } : undefined,
  });
  return {
    useAppStore: (selector: (state: { user?: { id: string } }) => unknown) =>
      selector(getState()),
    useUser: () => (s => s.user)(getState()),
    useUserId: () => (s => s.user?.id)(getState()),
  };
});

beforeEach(() => {
  mockStore.clear();
  mockTutorialsEnabled = true;
  mockUserId = 'user-1';
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useFeatureHint', () => {
  it('starts hidden when showOnMount is false', () => {
    const { result } = renderHook(() => useFeatureHint({ featureId: 'test' }));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasBeenShown).toBe(false);
  });

  it('shows immediately on mount when showOnMount is true and no delay', () => {
    const { result } = renderHook(() =>
      useFeatureHint({ featureId: 'test', showOnMount: true }),
    );

    expect(result.current.isVisible).toBe(true);
  });

  it('shows after delay when showOnMount is true with delay', () => {
    const { result } = renderHook(() =>
      useFeatureHint({ featureId: 'test', showOnMount: true, delay: 500 }),
    );

    // Not visible before delay
    expect(result.current.isVisible).toBe(false);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('does not show on mount when tutorials are disabled', () => {
    mockTutorialsEnabled = false;

    const { result } = renderHook(() =>
      useFeatureHint({ featureId: 'test', showOnMount: true }),
    );

    expect(result.current.isVisible).toBe(false);
  });

  it('does not show on mount when already shown before', () => {
    mockStore.set('feature_hint_shown_user-1_test', true);

    const { result } = renderHook(() =>
      useFeatureHint({ featureId: 'test', showOnMount: true }),
    );

    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasBeenShown).toBe(true);
  });

  it('actions.show() makes hint visible when tutorials enabled', () => {
    const { result } = renderHook(() => useFeatureHint({ featureId: 'test' }));

    act(() => {
      result.current.actions.show();
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('actions.show() does nothing when tutorials disabled', () => {
    mockTutorialsEnabled = false;

    const { result } = renderHook(() => useFeatureHint({ featureId: 'test' }));

    act(() => {
      result.current.actions.show();
    });

    expect(result.current.isVisible).toBe(false);
  });

  it('actions.dismiss() hides hint and persists to storage', () => {
    const { result } = renderHook(() =>
      useFeatureHint({ featureId: 'test', showOnMount: true }),
    );

    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.actions.dismiss();
    });

    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasBeenShown).toBe(true);
    expect(mockStore.get('feature_hint_shown_user-1_test')).toBe(true);
  });

  it('actions.hide() hides hint without persisting', () => {
    const { result } = renderHook(() =>
      useFeatureHint({ featureId: 'test', showOnMount: true }),
    );

    act(() => {
      result.current.actions.hide();
    });

    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasBeenShown).toBe(false);
    expect(mockStore.has('feature_hint_shown_user-1_test')).toBe(false);
  });

  it('actions.reset() clears persisted state', () => {
    mockStore.set('feature_hint_shown_user-1_test', true);

    const { result } = renderHook(() => useFeatureHint({ featureId: 'test' }));

    expect(result.current.hasBeenShown).toBe(true);

    act(() => {
      result.current.actions.reset();
    });

    expect(result.current.hasBeenShown).toBe(false);
    expect(result.current.isVisible).toBe(false);
    expect(mockStore.has('feature_hint_shown_user-1_test')).toBe(false);
  });

  it('scopes storage key per user', () => {
    const { result } = renderHook(() =>
      useFeatureHint({ featureId: 'hint1', showOnMount: true }),
    );

    act(() => {
      result.current.actions.dismiss();
    });

    expect(mockStore.has('feature_hint_shown_user-1_hint1')).toBe(true);
  });

  it('uses unscoped key when no user is logged in', () => {
    mockUserId = undefined;

    const { result } = renderHook(() =>
      useFeatureHint({ featureId: 'hint1', showOnMount: true }),
    );

    act(() => {
      result.current.actions.dismiss();
    });

    expect(mockStore.has('feature_hint_shown_hint1')).toBe(true);
  });
});
