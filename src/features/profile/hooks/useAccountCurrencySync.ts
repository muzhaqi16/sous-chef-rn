import { useEffect } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { useUser } from '#store/useAppStore';
import { useStore } from '#store';

/**
 * Keeps this device's money in the currency the account's settings hold. No
 * live event carries a settings write, so one made on another device arrives
 * when the resync re-reads this app-wide query.
 */
export function useAccountCurrencySync(): void {
  const user = useUser();
  const { data } = useQuery(GetUserSettingsDocument, user?.id ? {} : skipToken);
  const currency = data?.me?.settings?.preferredCurrency;

  // Keyed on the server's value alone: a pick in flight moves the mirror ahead
  // of it (`useCurrencyPreference`), and reacting to that would undo the pick.
  useEffect(() => {
    if (!currency) return;
    const store = useStore.getState();
    if (store.preferredCurrency !== currency) {
      store.setPreferredCurrency(currency);
    }
    // The persisted record follows: at the next launch it wins over the mirror.
    if (store.user && store.user.preferredCurrency !== currency) {
      store.updateUser({ preferredCurrency: currency });
    }
  }, [currency]);
}
