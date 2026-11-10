import {
  useState,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from 'react';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useAppStore, useShowTutorials, useUserId } from '#store/useAppStore';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { useOverlayBackdropPresence } from '#components/providers/OverlayBackdropProvider';
import { useTutorialResetSignal } from '#hooks/ui/useTutorialResetSignal';
import {
  hasFeatureHintBeenShown,
  markFeatureHintShown,
} from '#/hooks/settings/useFeatureHint';
import { Telemetry } from '#services/telemetry';
import { storeApi } from '#store';
import { onTutorialEvent, type TutorialEvent } from '#domain/tutorialEvents';
import { tutorialSession, useTutorialSession } from './tutorialSession';

/** How long a step waits for its target to measure before it is skipped. */
const DEFAULT_TARGET_TIMEOUT_MS = 1500;

// ── Public types ──

export interface TutorialStep {
  featureId: string;
  title: string;
  subtitle: string;
  /** Key into the targetRects record */
  rectKey: string;
  /** Absent, the step applies; one that does not is neither shown nor counted. */
  when?: () => boolean;
  /** How long the step waits for its target before the sequence moves on. */
  targetTimeoutMs?: number;
  /** `next`, the default, continues on the tip's button; an event, on the action. */
  advanceOn?: 'next' | { event: TutorialEvent };
  /**
   * `inline` is a hint inside the sheet the step happens in, not a spotlight:
   * it needs no target, and its own sheet and keyboard do not pause it.
   */
  presentation?: 'spotlight' | 'inline';
  /** A hand showing the gesture over the target. */
  demo?: 'swipe' | 'longPress';
}

export interface UseTutorialSequenceOptions {
  steps: TutorialStep[];
  targetRects: Record<string, TargetRect | null>;
  /** Whether all preconditions are met to start the tutorial */
  canStart: boolean;
  /** When true, the current step is hidden (e.g. overlay open, screen unfocused) */
  isPaused: boolean;
  /** Delay before first step appears (default 2000ms) */
  startDelay?: number;
  /** Names the tour for Not now and the session's one unasked tour. */
  tourId?: string;
  /**
   * Started by the user (the Getting started card): it runs with tips off, past
   * the session limit, and over the sheets it opens itself.
   */
  startedByUser?: boolean;
}

export interface TutorialStepConfig {
  /** Which step it is, for a screen that acts on the step shown. */
  featureId: string;
  targetRect: TargetRect;
  title: string;
  subtitle: string;
  stepIndex: number;
  totalSteps: number;
  /** The step continues on the user's action, not a Next button. */
  waitsForAction: boolean;
  demo?: 'swipe' | 'longPress';
}

/** An inline step, for the sheet that shows it. */
export interface TutorialInlineStep {
  title: string;
  subtitle: string;
  stepIndex: number;
  totalSteps: number;
}

export interface UseTutorialSequenceReturn {
  /** The spotlight step showing, if any. */
  currentStep: TutorialStepConfig | null;
  /** The inline step showing, if any. */
  inlineStep: TutorialInlineStep | null;
  /**
   * The target the next step will point at, while the tour is unfinished, so
   * it can be measured before the step shows.
   */
  activeRectKey: string | null;
  /** Dismiss current step and advance to next */
  advance: () => void;
  /** Advance without the transition gap — keeps the overlay mounted so the
   *  spotlight can seamlessly move to the next target (used by swipe-to-advance). */
  advanceInPlace: () => void;
  /** "End tour": every step counts as shown, so it does not come back. */
  skipAll: () => void;
  /** "Not now": hidden for this session, marking nothing, so it resumes later. */
  pause: () => void;
}

// ── Hook ──

export const useTutorialSequence = ({
  steps,
  targetRects,
  canStart,
  isPaused,
  startDelay = 2000,
  tourId,
  startedByUser = false,
}: UseTutorialSequenceOptions): UseTutorialSequenceReturn => {
  const userId = useUserId();
  const tutorialsEnabled = useShowTutorials();
  const session = useTutorialSession();
  const overlayOpen = useOverlayBackdropPresence();
  const keyboardShown = useKeyboardState(keyboard => keyboard.isVisible);
  const lastUnaskedAt = useAppStore(state =>
    userId ? state.lastUnpromptedTipAt[userId] : undefined,
  );
  const tour = tourId ?? steps[0]?.featureId ?? '';

  // Incrementing this forces re-derivation of activeStepIndex after
  // MMKV writes (advance/skipAll). Without it React wouldn't know to re-render
  // because MMKV writes don't trigger React state updates on their own.
  const [generation, setGeneration] = useState(0);

  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Steps whose target never measured, passed over for this mount only: the
  // next visit tries them again.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [paused, setPaused] = useState(false);

  // React to external resets (centralized signal hook)
  const wasReset = useTutorialResetSignal();
  if (wasReset) {
    setGeneration(0);
    setHasStarted(false);
    setIsTransitioning(false);
    setSkipped(new Set());
    setPaused(false);
  }

  // A tour the user started runs whatever the switch, the session's limit or
  // an earlier Not now; it pauses only for the caller's own signals (its
  // screen leaving focus, a selector open), since it opens sheets itself. One
  // shown unasked waits for tips on, its account's slot this session, and a
  // clear screen. The slot outlives a sign-out through `lastUnpromptedTipAt`.
  const { unprompted } = session;
  const claimed =
    unprompted && unprompted.userId === userId ? unprompted.tour : null;
  const slotFree =
    claimed === null
      ? (lastUnaskedAt ?? 0) < session.startedAt
      : claimed === tour;
  const allowed = startedByUser
    ? true
    : tutorialsEnabled &&
      !session.onboardingFinished &&
      !session.pausedTours.has(tour) &&
      slotFree;

  const visibleSteps = steps.filter(step => step.when?.() ?? true);

  // The first step not yet shown, in order, whether or not its target has
  // measured: a later target measuring first must not jump the queue.
  // `generation` is referenced so the compiler sees this code depends on it.
  const activeStepIndex =
    generation >= 0
      ? visibleSteps.findIndex(
          step =>
            !skipped.has(step.featureId) &&
            // Through `hasFeatureHintBeenShown` rather than reading MMKV
            // directly, so the Detox suppression applies here too.
            !hasFeatureHintBeenShown(step.featureId, userId),
        )
      : -1;

  const allComplete = activeStepIndex === -1;
  const activeStep = visibleSteps[activeStepIndex];
  const inline = activeStep?.presentation === 'inline';
  const signalsPause = startedByUser
    ? false
    : (!inline && (overlayOpen || keyboardShown)) || !session.active;
  const activeRect = activeStep
    ? targetRects[activeStep.rectKey] ?? null
    : null;

  // Startup delay; none asked for starts at once.
  const canBegin = canStart && !allComplete && !hasStarted && allowed;
  if (canBegin && startDelay <= 0) setHasStarted(true);
  useEffect(() => {
    if (!canBegin || startDelay <= 0) return;
    const timer = setTimeout(() => {
      setHasStarted(true);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [canBegin, startDelay]);

  const running =
    hasStarted && allowed && !isPaused && !signalsPause && !paused;

  // A step whose target never measures is passed over, so the sequence never
  // waits on nothing.
  const waitingFor =
    running && activeStep && !inline && !activeRect
      ? activeStep.featureId
      : null;
  const targetTimeoutMs =
    activeStep?.targetTimeoutMs ?? DEFAULT_TARGET_TIMEOUT_MS;
  if (waitingFor !== null && targetTimeoutMs <= 0) {
    Telemetry.trackEvent('tour_target_timeout', {
      tour_id: tour,
      feature_id: waitingFor,
    });
    setSkipped(new Set(skipped).add(waitingFor));
  }
  useEffect(() => {
    if (waitingFor === null || targetTimeoutMs <= 0) return;
    const timer = setTimeout(() => {
      Telemetry.trackEvent('tour_target_timeout', {
        tour_id: tour,
        feature_id: waitingFor,
      });
      setSkipped(previous => new Set(previous).add(waitingFor));
    }, targetTimeoutMs);
    return () => clearTimeout(timer);
  }, [waitingFor, targetTimeoutMs, tour]);

  // Timer ref for advance transition cleanup
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear transition timer on unmount
  useLayoutEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const markShown = (featureId: string) => {
    markFeatureHintShown(featureId, userId);
  };

  const advance = () => {
    if (!activeStep) return;
    markShown(activeStep.featureId);
    setGeneration(g => g + 1);
    setIsTransitioning(true);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      setIsTransitioning(false);
    }, 400);
  };

  const advanceInPlace = () => {
    if (!activeStep) return;
    markShown(activeStep.featureId);
    setGeneration(g => g + 1);
  };

  // A step waiting for an action continues when it happens, however done,
  // while the tour runs: shown, or out of the way of the user's own path.
  const awaited =
    hasStarted && activeStep && activeStep.advanceOn !== undefined
      ? activeStep.advanceOn === 'next'
        ? null
        : activeStep.advanceOn.event
      : null;
  const onAwaited = useEffectEvent(() => advanceInPlace());
  useEffect(() => {
    if (awaited === null) return;
    return onTutorialEvent(event => {
      if (event === awaited) onAwaited();
    });
  }, [awaited]);

  const skipAll = () => {
    for (const step of steps) markShown(step.featureId);
    setGeneration(g => g + 1);
  };

  // Build output
  const isActive = running && !isTransitioning && activeStepIndex !== -1;

  const currentStep: TutorialStepConfig | null =
    isActive && activeStep && !inline && activeRect
      ? {
          featureId: activeStep.featureId,
          targetRect: activeRect,
          title: activeStep.title,
          subtitle: activeStep.subtitle,
          stepIndex: activeStepIndex,
          totalSteps: visibleSteps.length,
          waitsForAction:
            activeStep.advanceOn !== undefined &&
            activeStep.advanceOn !== 'next',
          demo: activeStep.demo,
        }
      : null;
  const inlineStep: TutorialInlineStep | null =
    isActive && activeStep && inline
      ? {
          title: activeStep.title,
          subtitle: activeStep.subtitle,
          stepIndex: activeStepIndex,
          totalSteps: visibleSteps.length,
        }
      : null;

  // Showing a tip unasked takes the account's one slot for the session.
  const shownUnasked =
    (currentStep !== null || inlineStep !== null) && !startedByUser;
  useEffect(() => {
    if (!shownUnasked) return;
    tutorialSession.claimUnprompted(userId, tour);
    if (userId) storeApi.getState().recordUnpromptedTip(userId, Date.now());
  }, [shownUnasked, tour, userId]);

  return {
    currentStep,
    inlineStep,
    activeRectKey: activeStep && !inline ? activeStep.rectKey : null,
    advance,
    advanceInPlace,
    skipAll,
    pause: () => {
      setPaused(true);
      tutorialSession.pause(tour);
    },
  };
};
