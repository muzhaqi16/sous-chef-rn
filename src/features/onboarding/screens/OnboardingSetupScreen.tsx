import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { Loading } from '#components/molecules/Loading';
import { OnboardingErrorBoundary } from '#components/providers/ScreenErrorBoundary';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { InviteCard } from '#features/onboarding/components/InviteCard';
import { useOnboardingSetup } from '#features/onboarding/hooks/useOnboardingSetup';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingNavigation } from './useOnboardingNavigation';
import { useOnboardingInvites } from './useOnboardingInvites';

type Phase =
  | { kind: 'working' }
  | { kind: 'failed'; message: string; createMissingHome: boolean };

const OnboardingSetupScreenComponent = () => {
  const { t } = useTranslation();
  useScreenTransition('OnboardingSetupScreen');
  const setup = useOnboardingSetup();
  const { invites, loading: invitesLoading } = useOnboardingInvites();
  const { navigateToNextStep } = useOnboardingNavigation();
  // Null until setup starts: until then, pending invitations are offered.
  const [phase, setPhase] = useState<Phase | null>(null);
  // Set once setup has started: React runs a mount effect twice in development,
  // and a second start would create a second home.
  const startedRef = useRef(false);

  const start = (createMissingHome: boolean) => {
    startedRef.current = true;
    setPhase({ kind: 'working' });
    void setup.run({ createMissingHome }).then(outcome => {
      if (outcome.status === 'done') {
        navigateToNextStep('OnboardingSetup');
      } else {
        setPhase({
          kind: 'failed',
          message: outcome.message,
          createMissingHome,
        });
      }
    });
  };

  const ready = !setup.loading && !invitesLoading;
  const offersInvites = !setup.hasHome && invites.length > 0;
  const startUnasked = useEffectEvent(() => {
    if (startedRef.current || offersInvites) return;
    start(true);
  });
  useEffect(() => {
    if (ready) startUnasked();
  }, [ready]);

  if (!phase && ready && offersInvites) {
    return (
      <OnBoardingWrapper
        title={t('onBoarding.pendingInvitesTitle')}
        subtitle={t('onBoarding.pendingInvitesSubtitle')}
        primaryAction={
          <Button
            title={t('onBoarding.createOwnHome')}
            onPress={() => start(true)}
            variant="primary"
            testID={onboardingTestIDs.setupCreateHome}
          />
        }
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
          onPress={() => start(false)}
          variant="ghost"
          testID={onboardingTestIDs.setupSkipHome}
        />
      </OnBoardingWrapper>
    );
  }

  if (phase?.kind === 'failed') {
    return (
      <OnBoardingWrapper
        title={t('onBoarding.setupFailedTitle')}
        primaryAction={
          <Button
            title={t('labels.tryAgain')}
            onPress={() => start(phase.createMissingHome)}
            variant="primary"
          />
        }
        testID={onboardingTestIDs.setupScreen}
      >
        <Text role="body" tone="secondary" align="center">
          {phase.message}
        </Text>
        <Button
          title={t('labels.continue')}
          onPress={() => navigateToNextStep('OnboardingSetup')}
          variant="ghost"
        />
      </OnBoardingWrapper>
    );
  }

  // Reading what exists claims no setup: an invitation may still be offered.
  return (
    <OnBoardingWrapper
      title={phase ? t('onBoarding.settingUpTitle') : undefined}
      testID={onboardingTestIDs.setupScreen}
    >
      <Loading />
    </OnBoardingWrapper>
  );
};

/** Selects or creates the home, pantry and list, asking only about invitations. */
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
