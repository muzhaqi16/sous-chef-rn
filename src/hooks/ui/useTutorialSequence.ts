import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useShowTutorials } from '#store/useAppStore';
import { useUserId } from '#store/useAppStore';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { useTutorialResetSignal } from '#hooks/ui/useTutorialResetSignal';
import { hasFeatureHintBeenShown } from '#/hooks/useFeatureHint';
import { storeApi } from '#store';

// Same prefix used by useFeatureHint — keeps storage compatible with
// resetAllFeatureHints() and hasFeatureHintBeenShown(). Per-account scoping
// so tutorials reset and re-show when a different user logs in.
const HINT_PREFIX = 'feature_hint_shown_';

const buildStorageKey = (userId: string | undefined, featureId: string) =>
  userId
    ? `${HINT_PREFIX}${userId}_${featureId}`
    : `${HINT_PREFIX}${featureId}`;

// ── Public types ──

export interface TutorialStep {
  featureId: string;
  title: string;
  subtitle: string;
  /** Key into the targetRects record */
  rectKey: string;
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
  isActive: boolean;
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

  // React to external resets (centralized signal hook)
  const wasReset = useTutorialResetSignal();
  if (wasReset) {
    setGeneration(0);
    setHasStarted(false);
    setIsTransitioning(false);
  }

  // Derive the first incomplete step from MMKV (synchronous, sub-ms read).
  // `generation` is referenced so the compiler sees this code depends on it.
  const activeStepIndex =
    generation >= 0
      ? steps.findIndex(step => {
          // Through `hasFeatureHintBeenShown` rather than reading MMKV
          // directly, so the Detox suppression applies here too. Reading the
          // key straight from storage is what made this sequence keep showing
          // under E2E after the shared helper was already suppressed.
          const shown = hasFeatureHintBeenShown(step.featureId, userId);
          const rect = targetRects[step.rectKey];
          return !shown && rect != null;
        })
      : -1;

  const allComplete = activeStepIndex === -1;

  // Startup delay
  useEffect(() => {
    if (!canStart || allComplete || hasStarted || !tutorialsEnabled) return;

    const timer = setTimeout(() => {
      setHasStarted(true);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [canStart, allComplete, hasStarted, startDelay, tutorialsEnabled]);

  // Timer ref for advance transition cleanup
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear transition timer on unmount
  useLayoutEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Stable refs for callbacks
  const stepsRef = useRef(steps);
  const userIdRef = useRef(userId);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const advance = () => {
    if (activeStepIndex === -1) return;
    const step = stepsRef.current[activeStepIndex];
    storeApi
      .getState()
      .markFeatureHintShown(buildStorageKey(userIdRef.current, step.featureId));
    setGeneration(g => g + 1);
    setIsTransitioning(true);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      setIsTransitioning(false);
    }, 400);
  };

  const advanceInPlace = () => {
    if (activeStepIndex === -1) return;
    const step = stepsRef.current[activeStepIndex];
    storeApi
      .getState()
      .markFeatureHintShown(buildStorageKey(userIdRef.current, step.featureId));
    setGeneration(g => g + 1);
  };

  const skipAll = () => {
    for (const step of stepsRef.current) {
      storeApi
        .getState()
        .markFeatureHintShown(
          buildStorageKey(userIdRef.current, step.featureId),
        );
    }
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
    isActive && activeStepIndex !== -1
      ? {
          targetRect: targetRects[steps[activeStepIndex].rectKey]!,
          title: steps[activeStepIndex].title,
          subtitle: steps[activeStepIndex].subtitle,
          stepIndex: activeStepIndex,
          totalSteps: steps.length,
        }
      : null;

  return { isActive, currentStep, advance, advanceInPlace, skipAll };
};
