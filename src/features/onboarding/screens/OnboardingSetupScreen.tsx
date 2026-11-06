import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { OnboardingErrorBoundary } from '#components/providers/ScreenErrorBoundary';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { OnboardingStepScaffold } from '#features/onboarding/components/OnboardingStepScaffold';
import { InviteCard } from '#features/onboarding/components/InviteCard';
import {
  startOnboardingSetup,
  useOnboardingSetup,
} from '#features/onboarding/hooks/useOnboardingSetup';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingNavigation } from './useOnboardingNavigation';
import { useOnboardingInvites } from './useOnboardingInvites';

const OnboardingSetupScreenComponent = () => {
  const { t } = useTranslation();
  useScreenTransition('OnboardingSetupScreen');
  const setup = useOnboardingSetup();
  const { invites } = useOnboardingInvites();
  const { navigateToNextStep } = useOnboardingNavigation();

  // Setup runs on while the questions are answered.
  const choose = (createMissingHome: boolean) => {
    startOnboardingSetup(setup.run, createMissingHome);
    navigateToNextStep('OnboardingSetup');
  };

  return (
    <OnboardingStepScaffold
      title={t('onBoarding.pendingInvitesTitle')}
      question={t('onBoarding.pendingInvitesSubtitle')}
      primary={{
        label: t('onBoarding.createOwnHome'),
        onPress: () => choose(true),
        testID: onboardingTestIDs.setupCreateHome,
      }}
      testID={onboardingTestIDs.setupScreen}
    >
      <View style={styles.invites}>
        <Text role="bodyStrong" style={styles.invitesTitle}>
          {t('labels.pendingInvitations')}
        </Text>
        {invites.map(invite => (
          <InviteCard key={invite.id} inviteRef={invite} />
        ))}
      </View>
      <Button
        title={t('onBoarding.skipForNow')}
        onPress={() => choose(false)}
        variant="ghost"
        testID={onboardingTestIDs.setupSkipHome}
      />
    </OnboardingStepScaffold>
  );
};

/**
 * Opened by the setup runner when the account has no home and invitations
 * wait: a home of one's own, or none until an invitation is accepted.
 */
export const OnboardingSetupScreen = () => (
  <OnboardingErrorBoundary>
    <OnboardingSetupScreenComponent />
  </OnboardingErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  invites: {
    marginVertical: theme.spacing.lg,
  },
  invitesTitle: {
    marginBottom: theme.spacing.md,
  },
}));
