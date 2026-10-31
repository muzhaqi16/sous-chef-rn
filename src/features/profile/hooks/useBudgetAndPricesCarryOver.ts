import { useEffect, useRef } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { useAppStore, useUser } from '#store/useAppStore';
import { useUpdateSettings } from '#hooks/settings/useUpdateSettings';

/**
 * Carries an "on" from the device's Budget & prices switch, which predates the
 * account keeping one, to the account once it has no answer. A device "off" is
 * never carried: the device wrote it as a default on any preference change.
 */
export function useBudgetAndPricesCarryOver(): void {
  const user = useUser();
  const { data } = useQuery(GetUserSettingsDocument, user?.id ? {} : skipToken);
  const answer = data?.me?.settings?.budgetAndPrices;
  const deviceOn = useAppStore(state =>
    user ? state.userPreferences[user.id]?.budgetAndPrices === true : false,
  );
  const { updateSettings } = useUpdateSettings();
  const carriedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || answer !== null || !deviceOn) return;
    if (carriedFor.current === user.id) return;
    carriedFor.current = user.id;
    void updateSettings({ budgetAndPrices: true });
  }, [user, answer, deviceOn, updateSettings]);
}
