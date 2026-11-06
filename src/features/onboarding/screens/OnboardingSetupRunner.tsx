import { useEffect, useEffectEvent, useRef } from 'react';
import { CommonActions } from '@react-navigation/native';
import {
  startOnboardingSetup,
  useOnboardingSetup,
} from '#features/onboarding/hooks/useOnboardingSetup';
import { useOnboardingSetupStore } from '#features/onboarding/store/onboardingProgressStore';
import { unreadAccountState } from '#features/onboarding/utils/unreadAccountState';
import { useOnboardingInvites } from './useOnboardingInvites';
import { routesToResume } from './useOnboardingNavigation';

interface OnboardingSetupRunnerProps {
  /** The onboarding stack's own navigation, from its layout. */
  navigation: {
    dispatch: (action: ReturnType<typeof CommonActions.reset>) => void;
  };
}

/**
 * Creates the home, pantry and list while the questions are answered, so no
 * screen or tap comes before the first. Pending invitations, with no home,
 * open the setup screen to choose first; an account it cannot read leaves the
 * setup to `OwedAccountSetup`. Renders nothing.
 */
export const OnboardingSetupRunner = ({
  navigation,
}: OnboardingSetupRunnerProps) => {
  const setup = useOnboardingSetup();
  const {
    invites,
    loading: invitesLoading,
    state: invitesState,
  } = useOnboardingInvites();
  const setSetupStatus = useOnboardingSetupStore(state => state.setSetupStatus);
  // React runs a mount effect twice in development: a second decision would
  // reopen the stack again, and setup itself runs once anyway.
  const decidedRef = useRef(false);

  const reopen = useEffectEvent(() => {
    void routesToResume('Household').then(routes => {
      // Invitations are asked about first; their choice reopens here itself.
      const { setup: status } = useOnboardingSetupStore.getState();
      if (routes.length > 1 && status.kind !== 'invited') {
        navigation.dispatch(
          CommonActions.reset({ index: routes.length - 1, routes }),
        );
      }
    });
  });
  useEffect(() => {
    reopen();
  }, []);

  const answered = !setup.loading && !invitesLoading;
  const decide = useEffectEvent(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    if (unreadAccountState(setup.readState, setup.hasHome, invitesState)) {
      setup.setOwed(true);
      setSetupStatus({ kind: 'owed' });
    } else if (!setup.hasHome && invites.length > 0) {
      setSetupStatus({ kind: 'invited' });
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'OnboardingSetup' }],
        }),
      );
    } else {
      startOnboardingSetup(setup.run, true);
    }
  });
  useEffect(() => {
    if (answered) decide();
  }, [answered]);

  return null;
};
