import { CommonActions, StackActions } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { storeApi } from '#store';
import { useSelectedPantryId } from '#store/useAppStore';
import { logger } from '#/utils/environment';
import type { OnboardingStackParams } from '#navigation/stacks/OnboardingStack';
import {
  recordReachedStep,
  setupExpectsPantry,
  storedResumableStep,
  useOnboardingSetupStore,
  type ResumableOnboardingStep,
} from '#features/onboarding/store/onboardingProgressStore';

/** An onboarding route. */
export type OnboardingStepId = keyof OnboardingStackParams;

/** What decides whether a step is shown to this user. */
export interface OnboardingStepContext {
  hasPantry: boolean;
}

export interface OnboardingStep {
  id: OnboardingStepId;
  /** A question the user answers, counted in "Step 2 of 3". */
  numbered: boolean;
  /** Absent, the step is always shown. */
  shownWhen?: (context: OnboardingStepContext) => boolean;
  /** Routes inside the step, shown under its number. */
  subRoutes?: readonly OnboardingStepId[];
}

// The one definition of the flow, exported so nothing else declares a second.
// Currency is NOT a step: it is inferred from the device region on first
// sign-in (`deviceRegionCurrency`) and corrected in Profile, because asking it
// here costs a step to answer a question the device already answers.
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: 'OnboardingSetup', numbered: false },
  { id: 'Household', numbered: true },
  { id: 'Dietary', numbered: true },
  // Without a pantry (an invited user who made no home) there is none to stock.
  {
    id: 'Receipt',
    numbered: true,
    shownWhen: ({ hasPantry }) => hasPantry,
    subRoutes: ['OnboardingReceiptScan', 'OnboardingReceiptReview'],
  },
  {
    id: 'OnboardingComplete',
    numbered: false,
    subRoutes: ['OnboardingStores'],
  },
];

/** The steps this user will see, in order. */
export const visibleOnboardingSteps = (
  context: OnboardingStepContext,
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): OnboardingStep[] => steps.filter(step => step.shownWhen?.(context) ?? true);

const isRouteOf = (step: OnboardingStep, route: string): boolean =>
  step.id === route || (step.subRoutes?.some(sub => sub === route) ?? false);

/**
 * A route's place among the numbered steps this user will see; null for a
 * route that is not one, which shows no number.
 */
export function onboardingProgress(
  route: string,
  context: OnboardingStepContext,
  steps: readonly OnboardingStep[] = ONBOARDING_STEPS,
): { step: number; total: number } | null {
  const numbered = visibleOnboardingSteps(context, steps).filter(
    step => step.numbered,
  );
  const index = numbered.findIndex(step => isRouteOf(step, route));
  return index < 0 ? null : { step: index + 1, total: numbered.length };
}

const isResumable = (id: OnboardingStepId): id is ResumableOnboardingStep =>
  id === 'Household' || id === 'Dietary' || id === 'Receipt';

/**
 * What decides which steps this user sees, read from the session. A pantry
 * setup is still making counts, so the step total does not change under them.
 */
export function useOnboardingStepContext(): OnboardingStepContext {
  const setup = useOnboardingSetupStore(state => state.setup);
  return { hasPantry: !!useSelectedPantryId() || setupExpectsPantry(setup) };
}

/** The same, read outside React at the moment of a navigation. */
const currentStepContext = (): OnboardingStepContext => ({
  hasPantry:
    !!storeApi.getState().selectedPantryId ||
    setupExpectsPantry(useOnboardingSetupStore.getState().setup),
});

/**
 * The questions from `first` up to the furthest reached before a restart, so
 * the stack reopens there with the earlier ones behind it for Back.
 */
export async function routesToResume(
  first: OnboardingStepId,
): Promise<{ name: OnboardingStepId }[]> {
  const resume = await storedResumableStep();
  const live = visibleOnboardingSteps(currentStepContext());
  const from = live.findIndex(step => step.id === first);
  const resumeIndex = resume ? live.findIndex(step => step.id === resume) : -1;
  return live
    .slice(from, Math.max(resumeIndex, from) + 1)
    .filter(step => step.numbered)
    .map(step => ({ name: step.id }));
}

export function useOnboardingNavigation() {
  // The raw prop: this hook dispatches reset/navigate actions and reads the
  // stack state, none of which the typed wrapper's named methods express.
  const { navigation } = useAppNavigation();
  const steps = visibleOnboardingSteps(useOnboardingStepContext());

  const indexOf = (currentScreen: OnboardingStepId): number => {
    const index = steps.findIndex(step => isRouteOf(step, currentScreen));
    if (index < 0)
      logger.warn(`Onboarding step not in the flow: ${currentScreen}`);
    return index;
  };

  const navigateToNextStep = (currentScreen: OnboardingStepId) => {
    const currentIndex = indexOf(currentScreen);
    if (currentIndex < 0) return;
    const next = steps[currentIndex + 1];
    if (!next) return;
    if (isResumable(next.id)) void recordReachedStep(next.id);

    // The completion screen replaces the stack, so there is no going back;
    // nor is there to setup, which has nothing to show once done.
    if (next.id === 'OnboardingComplete') {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: next.id }] }),
      );
    } else if (currentScreen === 'OnboardingSetup') {
      // The invitations' choice is made: on to the questions, reopening at
      // the furthest one reached before a restart.
      void routesToResume(next.id).then(routes => {
        navigation.dispatch(
          routes.length > 1
            ? CommonActions.reset({ index: routes.length - 1, routes })
            : StackActions.replace(next.id),
        );
      });
    } else {
      navigation.dispatch(CommonActions.navigate(next.id));
    }
  };

  // Back reaches only a question: setup has nothing to return to. A sub-route
  // returns to its own step.
  const navigateToPreviousStep = (currentScreen: OnboardingStepId) => {
    const currentIndex = indexOf(currentScreen);
    const current = steps[currentIndex];
    const previous =
      current && current.id !== currentScreen
        ? current
        : steps
            .slice(0, Math.max(currentIndex, 0))
            .reverse()
            .find(step => step.numbered);
    if (!previous) return;
    // `pop`: back to the step's own screen, with what it holds. A bare
    // navigate reuses only a route above this one, so it pushes a blank step.
    navigation.dispatch(
      CommonActions.navigate(previous.id, undefined, { pop: true }),
    );
  };

  /** Opens one of a step's sub-routes. */
  const navigateWithinStep = <Route extends OnboardingStepId>(
    subRoute: Route,
    params?: OnboardingStackParams[Route],
  ) => navigation.dispatch(CommonActions.navigate(subRoute, params));

  /** Opens an answered step from the summary; its save returns there. */
  const changeAnswer = (step: 'Dietary') =>
    navigation.dispatch(
      CommonActions.navigate(step, { returnTo: 'OnboardingComplete' }),
    );

  /** Back to the summary a changed answer was opened from. */
  const backToSummary = () => navigation.dispatch(StackActions.pop());

  return {
    navigateToNextStep,
    navigateToPreviousStep,
    navigateWithinStep,
    changeAnswer,
    backToSummary,
  };
}
