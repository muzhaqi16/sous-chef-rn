import { useEffect, useEffectEvent, useRef } from 'react';
import { useOnboardingSetup } from '#features/onboarding/hooks/useOnboardingSetup';
import { unreadAccountState } from '#features/onboarding/utils/unreadAccountState';
import { useAppStore, useUser } from '#store/useAppStore';
import { useOnboardingInvites } from '#features/onboarding/screens/useOnboardingInvites';

const FinishAccountSetup = () => {
  const setup = useOnboardingSetup();
  const { invites, loading, state } = useOnboardingInvites();
  const answered =
    !setup.loading &&
    !loading &&
    unreadAccountState(setup.readState, setup.hasHome, state) === null;
  const startedRef = useRef(false);

  const finish = useEffectEvent(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void setup
      .run({ createMissingHome: invites.length === 0 })
      .then(outcome => {
        if (outcome.status === 'done') setup.setOwed(false);
      });
  });
  useEffect(() => {
    if (answered) finish();
  }, [answered]);

  return null;
};

/**
 * The setup a person went past with the account unread: what to create depends
 * on what it holds, so it waits for the server's answer, wherever they are by
 * then. It reads nothing while no setup is owed.
 */
export const OwedAccountSetup = () => {
  const userId = useUser()?.id;
  const owed = useAppStore(state =>
    userId ? state.userPreferences[userId]?.accountSetupOwed === true : false,
  );
  return owed ? <FinishAccountSetup key={userId} /> : null;
};
