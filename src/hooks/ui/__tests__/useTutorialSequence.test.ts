import { renderHook, act } from '@testing-library/react-native';
import { useTutorialSequence, type TutorialStep } from '../useTutorialSequence';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';

import { useStore } from '#store';
import { Telemetry } from '#services/telemetry';
import { emitTutorialEvent } from '#domain/tutorialEvents';
import {
  startTutorialSession,
  tutorialSession,
  useTutorialSession,
} from '../tutorialSession';

/** The session as a component reads it. */
const sessionNow = () => renderHook(useTutorialSession).result.current;

/** The hint record the store keeps, in the shape these assertions read. */
const hints = () => useStore.getState().featureHintsShown;

let mockTutorialsOn = true;
let mockUserId = 'user-1';
jest.mock('#store/useAppStore', () => ({
  useUserId: () => mockUserId,
  useShowTutorials: () => mockTutorialsOn,
  useAppStore: (select: (state: unknown) => unknown) =>
    select(jest.requireActual('#store').useStore.getState()),
}));

let mockOverlayOpen = false;
jest.mock('#components/providers/OverlayBackdropProvider', () => ({
  useOverlayBackdropPresence: () => mockOverlayOpen,
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
  useStore.setState({ featureHintsShown: {}, lastUnpromptedTipAt: {} });
  startTutorialSession();
  mockTutorialsOn = true;
  mockUserId = 'user-1';
  mockOverlayOpen = false;
});

/** A later session: it starts after any tip recorded in this one. */
const nextSession = () => {
  jest.spyOn(Date, 'now').mockReturnValueOnce(Date.now() + 1);
  startTutorialSession();
};

/** A tour as a screen mounts it, shown at once. */
const renderTour = (
  options: {
    tourId?: string;
    startedByUser?: boolean;
    sequence?: TutorialStep[];
  } = {},
) =>
  renderHook(() =>
    useTutorialSequence({
      steps: options.sequence ?? steps,
      targetRects,
      canStart: true,
      isPaused: false,
      startDelay: 0,
      tourId: options.tourId ?? 'tour-1',
      startedByUser: options.startedByUser,
    }),
  );

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
  it('hides the step without marking it, so a later session shows it again', () => {
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

describe('useTutorialSequence — a tour continues on the action', () => {
  it('moves on when the awaited action happens, however it is done', () => {
    const { result } = renderTour({
      sequence: [
        {
          ...steps[0]!,
          advanceOn: { event: 'list.itemAdded' },
        },
        steps[1]!,
      ],
    });
    expect(result.current.currentStep).toMatchObject({
      title: 'A',
      waitsForAction: true,
    });

    act(() => emitTutorialEvent('list.itemAdded'));

    expect(result.current.currentStep?.title).toBe('B');
    expect(hints()['feature_hint_shown_user-1_step_a']).toBe(true);
  });

  it('ignores other actions', () => {
    const { result } = renderTour({
      sequence: [{ ...steps[0]!, advanceOn: { event: 'list.itemAdded' } }],
    });

    act(() => emitTutorialEvent('list.movedToPantry'));

    expect(result.current.currentStep?.title).toBe('A');
  });
});

describe('useTutorialSequence — done only when it finishes', () => {
  it('resumes at the step reached after the app closes mid-tour', () => {
    const first = renderTour();
    act(() => first.result.current.advance());
    first.unmount();

    const again = renderTour();

    expect(again.result.current.currentStep?.title).toBe('B');
    expect(hints()['feature_hint_shown_user-1_step_b']).toBeUndefined();
  });
});

describe('useTutorialSequence — Not now pauses; ending stops for good', () => {
  it('Not now: away for this session, back in the next', () => {
    const first = renderTour();
    act(() => first.result.current.pause());
    expect(first.result.current.currentStep).toBeNull();
    first.unmount();

    expect(renderTour().result.current.currentStep).toBeNull();

    act(() => nextSession());
    expect(renderTour().result.current.currentStep?.title).toBe('A');
  });

  it('Not now still lets the user start it from Getting started', () => {
    act(() => tutorialSession.pause('tour-1'));

    const started = renderTour({ startedByUser: true });

    expect(started.result.current.currentStep?.title).toBe('A');
  });

  it('ending it marks every step, so it never shows again', () => {
    const first = renderTour();
    act(() => first.result.current.skipAll());
    first.unmount();

    act(() => nextSession());
    expect(renderTour().result.current.currentStep).toBeNull();
  });
});

describe('useTutorialSequence — a guide started from Getting started', () => {
  it('A guide started with tips off: it runs', () => {
    mockTutorialsOn = false;
    act(() => tutorialSession.startGuide('tour-1'));

    expect(renderTour().result.current.currentStep?.title).toBe('A');
  });

  it('Leaving mid-guide: Not now puts it away, and starting it again resumes at the step reached', () => {
    act(() => tutorialSession.startGuide('tour-1'));
    const { result } = renderTour();
    act(() => result.current.advanceInPlace());
    act(() => result.current.pause());
    expect(result.current.currentStep).toBeNull();

    act(() => tutorialSession.startGuide('tour-1'));

    expect(result.current.currentStep?.title).toBe('B');
  });

  it('ends with its last step', () => {
    act(() => tutorialSession.startGuide('tour-1'));
    const { result } = renderTour();

    act(() => result.current.skipAll());

    expect([...sessionNow().startedGuides].includes('tour-1')).toBe(false);
  });
});

describe('useTutorialSequence — a step inside a sheet', () => {
  const inSheet: TutorialStep[] = [
    {
      featureId: 'step_pick',
      title: 'Tap +',
      subtitle: 'or add manually',
      rectKey: 'none',
      presentation: 'inline',
      advanceOn: { event: 'list.itemAdded' },
    },
  ];

  it('shows with no target, and its own sheet does not pause it', () => {
    mockOverlayOpen = true;
    const { result } = renderTour({ sequence: inSheet });

    expect(result.current.currentStep).toBeNull();
    expect(result.current.inlineStep?.title).toBe('Tap +');
    expect(result.current.activeRectKey).toBeNull();
  });

  it('continues on its action', () => {
    const { result } = renderTour({ sequence: inSheet });

    act(() => emitTutorialEvent('list.itemAdded'));

    expect(result.current.inlineStep).toBeNull();
    expect(hints()['feature_hint_shown_user-1_step_pick']).toBe(true);
  });
});

describe('useTutorialSequence — unprompted tips are rationed', () => {
  it('shows one unasked tour a session; a second waits for the next', () => {
    const shown = renderTour({ tourId: 'pantry' });
    expect(shown.result.current.currentStep?.title).toBe('A');

    const other = renderTour({
      tourId: 'recipes',
      sequence: [
        { featureId: 'step_c', title: 'C', subtitle: 'c', rectKey: 'a' },
      ],
    });
    expect(other.result.current.currentStep).toBeNull();

    act(() => nextSession());
    other.rerender({});
    expect(other.result.current.currentStep?.title).toBe('C');
  });

  it('gives each account on the phone its own; signing back in keeps the one used', () => {
    const recipes: TutorialStep[] = [
      { featureId: 'step_c', title: 'C', subtitle: 'c', rectKey: 'a' },
    ];
    expect(
      renderTour({ tourId: 'pantry' }).result.current.currentStep?.title,
    ).toBe('A');

    mockUserId = 'user-2';
    expect(
      renderTour({ tourId: 'recipes', sequence: recipes }).result.current
        .currentStep?.title,
    ).toBe('C');

    mockUserId = 'user-1';
    expect(
      renderTour({ tourId: 'recipes', sequence: recipes }).result.current
        .currentStep,
    ).toBeNull();
  });

  it('waits while a sheet is open', () => {
    mockOverlayOpen = true;
    const { result, rerender } = renderTour();
    expect(result.current.currentStep).toBeNull();

    mockOverlayOpen = false;
    rerender({});
    expect(result.current.currentStep?.title).toBe('A');
  });

  it('shows nothing unasked in the session onboarding finished', () => {
    act(() => tutorialSession.noteOnboardingFinished());

    expect(renderTour().result.current.currentStep).toBeNull();
    expect(
      renderTour({ startedByUser: true }).result.current.currentStep?.title,
    ).toBe('A');
  });
});

describe('useTutorialSequence — the Show tutorials switch', () => {
  it('switched off mid-tour, the tour closes', () => {
    const { result, rerender } = renderTour();
    expect(result.current.currentStep?.title).toBe('A');

    mockTutorialsOn = false;
    rerender({});

    expect(result.current.currentStep).toBeNull();
  });

  it('a guide the user starts runs with tips off, over a sheet of its own', () => {
    mockTutorialsOn = false;
    mockOverlayOpen = true;

    const { result } = renderTour({ startedByUser: true });

    expect(result.current.currentStep?.title).toBe('A');
  });
});

describe('useTutorialSequence — a tour never stalls', () => {
  it('reports a target that never measured as it passes over it', () => {
    renderTour({
      sequence: [
        { ...steps[0]!, rectKey: 'gone', targetTimeoutMs: 0 },
        steps[1]!,
      ],
    });

    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'tour_target_timeout',
      expect.objectContaining({ feature_id: 'step_a' }),
    );
  });
});
