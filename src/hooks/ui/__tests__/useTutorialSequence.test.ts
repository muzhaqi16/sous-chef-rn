import { renderHook, act } from '@testing-library/react-native';
import { useTutorialSequence } from '../useTutorialSequence';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';

jest.mock('#/storage/mmkv', () => {
  const store = new Map<string, boolean | string | number | ArrayBuffer>();
  return {
    __mockStore: store,
    storage: {
      getString: (key: string) => store.get(key),
      getNumber: (key: string) => store.get(key),
      getBoolean: (key: string) => store.get(key),
      set: (key: string, value: boolean | string | number | ArrayBuffer) =>
        store.set(key, value),
      remove: (key: string) => store.delete(key),
      delete: (key: string) => store.delete(key),
      contains: (key: string) => store.has(key),
      clearAll: () => store.clear(),
      getAllKeys: () => [...store.keys()],
    },
  };
});

const { __mockStore: mockStore } = jest.requireMock<{
  __mockStore: Map<string, boolean | string | number | ArrayBuffer>;
}>('#/storage/mmkv');

jest.mock('#hooks/settings/useSettings', () => ({
  useShowTutorials: () => true,
}));

jest.mock('#store/useAppStore', () => ({
  useUserId: () => 'user-1',
}));

jest.mock('#hooks/ui/useTutorialResetSignal', () => ({
  useTutorialResetSignal: () => false,
}));

const mockMarkSeen = jest.fn();
jest.mock('#hooks/ui/markTutorialsSeen', () => ({
  markTutorialsSeen: () => mockMarkSeen(),
}));

const rect: TargetRect = { x: 0, y: 0, width: 10, height: 10 };
const steps = [
  { featureId: 'step_a', title: 'A', subtitle: 'a', rectKey: 'a' },
  { featureId: 'step_b', title: 'B', subtitle: 'b', rectKey: 'b' },
];
const targetRects: Record<string, TargetRect | null> = { a: rect, b: rect };

const renderSequence = () =>
  renderHook(() =>
    useTutorialSequence({
      steps,
      targetRects,
      canStart: true,
      isPaused: false,
    }),
  );

beforeEach(() => {
  mockStore.clear();
  mockMarkSeen.mockClear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useTutorialSequence — account-level completion', () => {
  it('does not record completion until the final step is advanced', () => {
    const { result } = renderSequence();

    act(() => {
      result.current.advance(); // step A → step B remains
    });

    expect(mockStore.get('feature_hint_shown_user-1_step_a')).toBe(true);
    expect(mockMarkSeen).not.toHaveBeenCalled();

    act(() => {
      result.current.advance(); // step B is the last step
    });

    expect(mockStore.get('feature_hint_shown_user-1_step_b')).toBe(true);
    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
  });

  it('records completion immediately when the user skips the whole sequence', () => {
    const { result } = renderSequence();

    act(() => {
      result.current.skipAll();
    });

    expect(mockStore.get('feature_hint_shown_user-1_step_a')).toBe(true);
    expect(mockStore.get('feature_hint_shown_user-1_step_b')).toBe(true);
    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
  });
});
