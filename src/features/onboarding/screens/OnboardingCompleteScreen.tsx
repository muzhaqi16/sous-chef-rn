import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { OnboardingStepScaffold } from '#features/onboarding/components/OnboardingStepScaffold';
import { CompletionHero } from '#features/onboarding/components/CompletionHero';
import { SetupSummary } from '#features/onboarding/components/SetupSummary';
import { RecipePayoff } from '#features/onboarding/components/RecipePayoff';
import { OnboardingOffers } from '#features/onboarding/components/OnboardingOffers';
import {
  useAppStore,
  useSelectedHomeId,
  useUpdateUser,
  useUser,
} from '#store/useAppStore';
import { useCompleteOnboarding } from '#features/onboarding/hooks/useCompleteOnboarding';
import { useRecipePayoff } from '#features/onboarding/hooks/useRecipePayoff';
import { useAddMissingToList } from '#features/recipes/hooks/useAddMissingToList';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { Text } from '#components/atoms/Text';
import { useNotificationSettings } from '#features/notifications/hooks/useNotificationSettings';
import { useTurnOnPush } from '#features/notifications/screens/useTurnOnPush';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingSummary } from '#features/onboarding/hooks/useOnboardingSummary';
import { tutorialSession } from '#hooks/ui/tutorialSession';
import { useHouseholdAnswer } from '#features/onboarding/hooks/useHouseholdAnswer';
import { useOnboardingNavigation } from './useOnboardingNavigation';

export const OnboardingCompleteScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('OnboardingCompleteScreen');
  const user = useUser();
  const updateUser = useUpdateUser();
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { completeOnboarding } = useCompleteOnboarding(user?.id);
  const summary = useOnboardingSummary();
  const household = useHouseholdAnswer();
  const { changeAnswer } = useOnboardingNavigation();
  const homeId = useSelectedHomeId();
  const payoff = useRecipePayoff({
    hasStock: summary.receiptItems + summary.stapleItems > 0,
  });
  const addMissingToList = useAddMissingToList();
  const { settings, updateMultipleSettings } = useNotificationSettings();
  const { hasPermission, turnOnPush } = useTurnOnPush(updateMultipleSettings);

  const setPendingDeepLinkAction = useAppStore(
    state => state.setPendingDeepLinkAction,
  );

  /** True once onboarding is done; the main app then mounts by itself. */
  const handleComplete = async (): Promise<boolean> => {
    if (!user?.id) {
      setError(t('onBoarding.userNotFoundError'));
      return false;
    }

    setIsCompleting(true);
    setError(null);

    // A failure is alerted by the hook; the inline copy keeps it on screen.
    if (!(await completeOnboarding())) {
      setError(t('onBoarding.completeOnboardingError'));
      setIsCompleting(false);
      return false;
    }

    // Success — RootNavigator auto-navigates to main_app once onBoarded = true.
    // The app it opens on shows no tip unasked this session.
    tutorialSession.noteOnboardingFinished();
    updateUser({ onBoarded: true });
    setIsCompleting(false);
    return true;
  };

  // The reason first; the OS prompt only once the user agrees, then the
  // finish. Dismissing the dialog answers Not now. True once onboarding is done.
  const askThenComplete = (): Promise<boolean> => {
    if (hasPermission === true && settings.pushEnabled) return handleComplete();
    return new Promise(resolve => {
      alertService.alert(
        t('onBoarding.notifyTitle'),
        t('onBoarding.notifyMessage'),
        [
          {
            text: t('labels.notNow'),
            style: 'cancel',
            onPress: () => {
              void handleComplete().then(resolve);
            },
          },
          {
            text: t('onBoarding.notifyTurnOn'),
            onPress: () => {
              void turnOnPush({ expirationNotifications: true })
                .then(handleComplete)
                .then(resolve);
            },
          },
        ],
      );
    });
  };

  // Every way out asks the same: a recipe opens over Today once the app
  // shows, and a finish that failed drops it, so it never opens later.
  const openRecipe = async (recipeId: string) => {
    // A finish already running would be sent twice.
    if (isCompleting) return;
    setPendingDeepLinkAction({
      type: 'open_recipe',
      recipeId,
      timestamp: Date.now(),
    });
    if (!(await askThenComplete())) setPendingDeepLinkAction(null);
  };

  const handleGetStarted = () => {
    void askThenComplete();
  };

  return (
    // The hero carries the title: nothing is behind this screen to go back to.
    <OnboardingStepScaffold
      primary={{
        label: t('labels.getStarted'),
        onPress: handleGetStarted,
        loading: isCompleting,
      }}
      testID={onboardingTestIDs.completeScreen}
    >
      <View style={styles.container}>
        <CompletionHero
          subtitle={
            summary.homeAndPantry
              ? t('onBoarding.completeSubtitle')
              : t('onBoarding.readyToStart')
          }
        />
        <SetupSummary
          summary={summary}
          onChangeCooksFor={count => {
            void household.answer(count);
          }}
          onChangeDietary={() => changeAnswer('Dietary')}
        />

        <RecipePayoff
          rows={payoff.rows}
          popular={payoff.popular}
          showCheckLabel={payoff.showCheckLabel}
          cooksFor={summary.cooksFor}
          onAddMissing={addMissingToList}
          onOpen={recipeId => {
            void openRecipe(recipeId);
          }}
        />

        <OnboardingOffers homeId={homeId} cooksFor={summary.cooksFor} />

        <Text
          role="caption"
          tone="secondary"
          align="center"
          style={styles.infoText}
        >
          {t('onBoarding.completeInfo')}
        </Text>

        {!!error && (
          <View style={styles.errorContainer}>
            <Text role="error" tone="error" align="center">
              {error}
            </Text>
          </View>
        )}
      </View>
    </OnboardingStepScaffold>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  infoText: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
  },
  errorContainer: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
}));
