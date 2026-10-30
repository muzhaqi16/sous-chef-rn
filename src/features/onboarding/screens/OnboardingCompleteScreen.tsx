import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { shareUrl } from '#native/share';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { RecipePayoff } from '#features/onboarding/components/RecipePayoff';
import { Button } from '#components/molecules/Button';
import { useSelectedHomeId, useUpdateUser, useUser } from '#store/useAppStore';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { useCompleteOnboarding } from '#features/onboarding/hooks/useCompleteOnboarding';
import { useHouseholdInvite } from '#features/onboarding/hooks/useHouseholdInvite';
import { useRecipePayoff } from '#features/onboarding/hooks/useRecipePayoff';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { Text } from '#components/atoms/Text';
import { Icon } from '#components/atoms/Icon';
import { useNotificationSettings } from '#features/notifications/hooks/useNotificationSettings';
import { useTurnOnPush } from '#features/notifications/screens/useTurnOnPush';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import {
  useOnboardingSummary,
  type OnboardingSummary,
} from '#features/onboarding/hooks/useOnboardingSummary';

/** The summary's lines: the home first, then each step done here, in order. */
function summaryLines(summary: OnboardingSummary, t: Translate): string[] {
  const lines: string[] = [];
  if (summary.homeAndPantry && summary.shoppingList) {
    lines.push(t('onBoarding.summaryHomeReady'));
  } else if (summary.homeAndPantry) {
    lines.push(t('onBoarding.summaryHomeAndPantry'));
  } else if (summary.shoppingList) {
    lines.push(t('onBoarding.summaryShoppingList'));
  }
  if (summary.cooksFor !== null) {
    lines.push(t('onBoarding.summaryCooksFor', { count: summary.cooksFor }));
  }
  if (summary.dietarySaved) lines.push(t('onBoarding.summaryDietarySaved'));
  if (summary.receiptItems > 0) {
    lines.push(
      t('onBoarding.summaryReceiptItems', { count: summary.receiptItems }),
    );
  }
  if (summary.stapleItems > 0) {
    lines.push(
      t('onBoarding.summaryStapleItems', { count: summary.stapleItems }),
    );
  }
  return lines;
}

/** Invites the people the user cooks for to their home, by its join link. */
const InviteHousehold = ({ homeId }: { homeId: string }) => {
  const { t } = useTranslation();
  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const { inviteLink } = useHouseholdInvite(homeId);
  const [sharing, setSharing] = useState(false);
  const [failed, setFailed] = useState(false);

  const invite = async () => {
    if (!requireVerifiedEmail()) return;
    setSharing(true);
    setFailed(false);
    const url = await inviteLink();
    setSharing(false);
    if (url) await shareUrl(url, t('homeDetail.shareLinkMessage'));
    else setFailed(true);
  };

  return (
    <View style={styles.invite}>
      <Button
        title={t('onBoarding.inviteHousehold')}
        icon="person-add-outline"
        onPress={() => {
          void invite();
        }}
        variant="outline"
        loading={sharing}
        testID={onboardingTestIDs.invite}
      />
      {failed ? (
        <Text role="error" tone="error" align="center">
          {t('onBoarding.inviteFailed')}
        </Text>
      ) : null}
    </View>
  );
};

export const OnboardingCompleteScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('OnboardingCompleteScreen');
  const user = useUser();
  const updateUser = useUpdateUser();
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { completeOnboarding } = useCompleteOnboarding(user?.id);
  const summary = useOnboardingSummary();
  const homeId = useSelectedHomeId();
  const payoff = useRecipePayoff();
  const { settings, updateMultipleSettings } = useNotificationSettings();
  const { hasPermission, turnOnPush } = useTurnOnPush(updateMultipleSettings);
  // Only what the user has: a skipped step is never claimed.
  const completed = summaryLines(summary, t);

  const handleComplete = async () => {
    if (!user?.id) {
      setError(t('onBoarding.userNotFoundError'));
      return;
    }

    setIsCompleting(true);
    setError(null);

    // A failure is alerted by the hook; the inline copy keeps it on screen.
    if (!(await completeOnboarding())) {
      setError(t('onBoarding.completeOnboardingError'));
      setIsCompleting(false);
      return;
    }

    // Success — RootNavigator auto-navigates to main_app once onBoarded = true.
    updateUser({ onBoarded: true });
    setIsCompleting(false);
  };

  // The reason first; the OS prompt only once the user agrees. Dismissing the
  // dialog answers Not now.
  const handleGetStarted = () => {
    if (hasPermission === true && settings.pushEnabled) {
      void handleComplete();
      return;
    }
    alertService.alert(
      t('onBoarding.notifyTitle'),
      t('onBoarding.notifyMessage'),
      [
        {
          text: t('labels.notNow'),
          style: 'cancel',
          onPress: () => {
            void handleComplete();
          },
        },
        {
          text: t('onBoarding.notifyTurnOn'),
          onPress: () => {
            void turnOnPush({ expirationNotifications: true }).then(
              handleComplete,
            );
          },
        },
      ],
    );
  };

  return (
    <OnBoardingWrapper
      title={t('onBoarding.completeTitle')}
      subtitle={
        summary.homeAndPantry
          ? t('onBoarding.completeSubtitle')
          : t('onBoarding.readyToStart')
      }
      primaryAction={
        <Button
          title={t('labels.getStarted')}
          onPress={handleGetStarted}
          variant="primary"
          loading={isCompleting}
        />
      }
      testID={onboardingTestIDs.completeScreen}
    >
      <View style={styles.container}>
        <View style={styles.successIcon}>
          <Icon name="checkmark" size={44} tone="onSuccess" />
        </View>

        {completed.length > 0 ? (
          <>
            <Text role="heading" align="center" style={styles.congratsText}>
              {t('onBoarding.congratulations')}
            </Text>
            <View style={styles.summaryList}>
              {completed.map(line => (
                <Text
                  key={line}
                  role="body"
                  tone="secondary"
                  style={styles.summaryItem}
                >
                  {`• ${line}`}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <Text role="body" align="center" style={styles.congratsText}>
            {t('onBoarding.nothingSetUp')}
          </Text>
        )}

        <RecipePayoff
          rows={payoff.rows}
          showCheckLabel={payoff.showCheckLabel}
        />

        {homeId && summary.cooksFor !== null && summary.cooksFor > 1 ? (
          <InviteHousehold homeId={homeId} />
        ) : null}

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
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  congratsText: {
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  summaryList: {
    marginBottom: theme.spacing.xl,
  },
  summaryItem: {
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
  },
  invite: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  errorContainer: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
}));
