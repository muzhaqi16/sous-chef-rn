import { renderHook, act } from '@testing-library/react-native';
import { useTutorialSequence } from '../useTutorialSequence';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';

jest.mock('#/storage/mmkv');

const { __mockStore: mockStore } = jest.requireMock<{
  __mockStore: Map<string, boolean | string | number | ArrayBuffer>;
}>('#/storage/mmkv');

jest.mock('#hooks/settings/useShowTutorials', () => ({
  useShowTutorials: () => true,
}));

jest.mock('#store/useAppStore', () => ({
  useUserId: () => 'user-1',
}));

jest.mock('#hooks/ui/useTutorialResetSignal', () => ({
  useTutorialResetSignal: () => false,
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
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useTutorialSequence — per-step completion', () => {
  it('records each step in MMKV as it is advanced, scoped to this sequence only', () => {
    const { result } = renderSequence();

    act(() => {
      result.current.advance(); // step A → step B remains
    });

    expect(mockStore.get('feature_hint_shown_user-1_step_a')).toBe(true);
    expect(mockStore.get('user_show_tutorials')).toBeUndefined();

    act(() => {
      result.current.advance(); // step B is the last step
    });

    expect(mockStore.get('feature_hint_shown_user-1_step_b')).toBe(true);
    // Finishing this sequence must not touch the global tutorials-enabled
    // flag — that flag is only set by the user via Settings.
    expect(mockStore.get('user_show_tutorials')).toBeUndefined();
  });

  it('records every step when the user skips the whole sequence, without touching the global flag', () => {
    const { result } = renderSequence();

    act(() => {
      result.current.skipAll();
    });

    expect(mockStore.get('feature_hint_shown_user-1_step_a')).toBe(true);
    expect(mockStore.get('feature_hint_shown_user-1_step_b')).toBe(true);
    expect(mockStore.get('user_show_tutorials')).toBeUndefined();
  });
});
