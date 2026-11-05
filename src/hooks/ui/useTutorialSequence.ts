import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useShowTutorials } from '#store/useAppStore';
import { useUserId } from '#store/useAppStore';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { useTutorialResetSignal } from '#hooks/ui/useTutorialResetSignal';
import { hasFeatureHintBeenShown } from '#/hooks/settings/useFeatureHint';
import { storeApi } from '#store';

// Same key shape as `#hooks/settings/useFeatureHint`'s helpers, so resetAllFeatureHints()
// and hasFeatureHintBeenShown() see these steps. Per-account scoping so
// tutorials re-show when a different user logs in.
const HINT_PREFIX = 'feature_hint_shown_';

const buildStorageKey = (userId: string | undefined, featureId: string) =>
  userId
    ? `${HINT_PREFIX}${userId}_${featureId}`
    : `${HINT_PREFIX}${featureId}`;

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
}

export interface TutorialStepConfig {
  targetRect: TargetRect;
  title: string;
  subtitle: string;
  stepIndex: number;
  totalSteps: number;
}

export interface UseTutorialSequenceReturn {
  currentStep: TutorialStepConfig | null;
  /** Dismiss current step and advance to next */
  advance: () => void;
  /** Advance without the transition gap — keeps the overlay mounted so the
   *  spotlight can seamlessly move to the next target (used by swipe-to-advance). */
  advanceInPlace: () => void;
  /** Dismiss all remaining steps */
  skipAll: () => void;
}

// ── Hook ──

export const useTutorialSequence = ({
  steps,
  targetRects,
  canStart,
  isPaused,
  startDelay = 2000,
}: UseTutorialSequenceOptions): UseTutorialSequenceReturn => {
  const userId = useUserId();
  const tutorialsEnabled = useShowTutorials();

  // Incrementing this forces re-derivation of activeStepIndex after
  // MMKV writes (advance/skipAll). Without it React wouldn't know to re-render
  // because MMKV writes don't trigger React state updates on their own.
  const [generation, setGeneration] = useState(0);

  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Steps whose target never measured, passed over for this mount only: the
  // next visit tries them again.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());

  // React to external resets (centralized signal hook)
  const wasReset = useTutorialResetSignal();
  if (wasReset) {
    setGeneration(0);
    setHasStarted(false);
    setIsTransitioning(false);
    setSkipped(new Set());
  }

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
  const activeRect = activeStep
    ? targetRects[activeStep.rectKey] ?? null
    : null;

  // Startup delay; none asked for starts at once.
  const canBegin = canStart && !allComplete && !hasStarted && tutorialsEnabled;
  if (canBegin && startDelay <= 0) setHasStarted(true);
  useEffect(() => {
    if (!canBegin || startDelay <= 0) return;
    const timer = setTimeout(() => {
      setHasStarted(true);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [canBegin, startDelay]);

  // A step whose target never measures is passed over, so the sequence never
  // waits on nothing.
  const waitingFor =
    hasStarted && tutorialsEnabled && !isPaused && activeStep && !activeRect
      ? activeStep.featureId
      : null;
  const targetTimeoutMs =
    activeStep?.targetTimeoutMs ?? DEFAULT_TARGET_TIMEOUT_MS;
  if (waitingFor !== null && targetTimeoutMs <= 0) {
    setSkipped(new Set(skipped).add(waitingFor));
  }
  useEffect(() => {
    if (waitingFor === null || targetTimeoutMs <= 0) return;
    const timer = setTimeout(() => {
      setSkipped(previous => new Set(previous).add(waitingFor));
    }, targetTimeoutMs);
    return () => clearTimeout(timer);
  }, [waitingFor, targetTimeoutMs]);

  // Timer ref for advance transition cleanup
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear transition timer on unmount
  useLayoutEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const markShown = (featureId: string) => {
    storeApi
      .getState()
      .markFeatureHintShown(buildStorageKey(userId, featureId));
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

  const skipAll = () => {
    for (const step of steps) markShown(step.featureId);
    setGeneration(g => g + 1);
  };

  // Build output
  const isActive =
    hasStarted &&
    tutorialsEnabled &&
    !isPaused &&
    !isTransitioning &&
    activeStepIndex !== -1;

  const currentStep: TutorialStepConfig | null =
    isActive && activeStep && activeRect
      ? {
          targetRect: activeRect,
          title: activeStep.title,
          subtitle: activeStep.subtitle,
          stepIndex: activeStepIndex,
          totalSteps: visibleSteps.length,
        }
      : null;

  return { currentStep, advance, advanceInPlace, skipAll };
};
