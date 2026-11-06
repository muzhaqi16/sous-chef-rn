import { renderHook, act } from '@testing-library/react-native';
import { useTutorialSequence, type TutorialStep } from '../useTutorialSequence';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';

import { useStore } from '#store';

/** The hint record the store keeps, in the shape these assertions read. */
const hints = () => useStore.getState().featureHintsShown;

jest.mock('#store/useAppStore', () => ({
  useUserId: () => 'user-1',
  useShowTutorials: () => true,
}));

jest.mock('#hooks/ui/useTutorialResetSignal', () => ({
  useTutorialResetSignal: () => false,
}));

const rect: TargetRect = { x: 0, y: 0, width: 10, height: 10 };
const steps: TutorialStep[] = [
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
  useStore.getState().clearAllFeatureHints();
});

describe('useTutorialSequence — per-step completion', () => {
  it('records each step in MMKV as it is advanced, scoped to this sequence only', () => {
    const { result } = renderSequence();

    act(() => {
      result.current.advance(); // step A → step B remains
    });

    expect(hints()['feature_hint_shown_user-1_step_a']).toBe(true);
    expect(useStore.getState().showTutorials).toBe(true);

    act(() => {
      result.current.advance(); // step B is the last step
    });

    expect(hints()['feature_hint_shown_user-1_step_b']).toBe(true);
    // Finishing this sequence must not touch the global tutorials-enabled
    // flag — that flag is only set by the user via Settings.
    expect(useStore.getState().showTutorials).toBe(true);
  });

  it('records every step when the user skips the whole sequence, without touching the global flag', () => {
    const { result } = renderSequence();

    act(() => {
      result.current.skipAll();
    });

    expect(hints()['feature_hint_shown_user-1_step_a']).toBe(true);
    expect(hints()['feature_hint_shown_user-1_step_b']).toBe(true);
    expect(useStore.getState().showTutorials).toBe(true);
  });
});

describe('useTutorialSequence — order and missing targets', () => {
  type Props = { rects: Record<string, TargetRect | null> };

  // Every title the hook ever rendered, so a step shown early is caught.
  const renderObserved = (
    sequence: TutorialStep[],
    initialRects: Props['rects'],
  ) => {
    const titles: (string | null)[] = [];
    const rendered = renderHook(
      ({ rects }: Props) => {
        const result = useTutorialSequence({
          steps: sequence,
          targetRects: rects,
          canStart: true,
          isPaused: false,
          startDelay: 0,
        });
        titles.push(result.currentStep?.title ?? null);
        return result;
      },
      { initialProps: { rects: initialRects } },
    );
    return { ...rendered, titles };
  };

  it('shows steps in order when the second target measures first', () => {
    const { result, rerender, titles } = renderObserved(
      [{ ...steps[0]!, targetTimeoutMs: 60_000 }, steps[1]!],
      { a: null, b: rect },
    );

    rerender({ rects: { a: rect, b: rect } });

    expect(result.current.currentStep?.title).toBe('A');
    expect(titles).not.toContain('B');
  });

  it('passes over a step whose target never measures', () => {
    const { result } = renderObserved(
      [{ ...steps[0]!, targetTimeoutMs: 0 }, steps[1]!],
      { a: null, b: rect },
    );

    expect(result.current.currentStep?.title).toBe('B');
    expect(result.current.currentStep).toMatchObject({
      stepIndex: 1,
      totalSteps: 2,
    });
    // Passed over, not seen: a later visit tries it again.
    expect(hints()['feature_hint_shown_user-1_step_a']).toBeUndefined();
  });

  it('neither shows nor counts a step that does not apply', () => {
    const { result } = renderObserved(
      [{ ...steps[0]!, when: () => false }, steps[1]!],
      { a: rect, b: rect },
    );

    expect(result.current.currentStep?.title).toBe('B');
    expect(result.current.currentStep).toMatchObject({
      stepIndex: 0,
      totalSteps: 1,
    });
  });
});

describe('useTutorialSequence — not now', () => {
  it('hides the step without marking it, so a later visit shows it again', () => {
    const { result } = renderHook(() =>
      useTutorialSequence({
        steps,
        targetRects,
        canStart: true,
        isPaused: false,
        startDelay: 0,
      }),
    );
    expect(result.current.currentStep?.title).toBe('A');

    act(() => {
      result.current.pause();
    });

    expect(result.current.currentStep).toBeNull();
    expect(hints()['feature_hint_shown_user-1_step_a']).toBeUndefined();
  });
});
