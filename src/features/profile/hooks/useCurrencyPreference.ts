import { useMutation, useQuery } from '@apollo/client/react';
import { UpdateAccountDocument } from '#operations/auth/user.generated';
import { GetCurrenciesDocument } from '#features/profile/graphql/currency.generated';
import { useAppStore } from '#store/useAppStore';
import { usePreferredCurrency } from '#/domain/money';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';

export interface CurrencyOption {
  value: string;
  label: string;
}

/**
 * The account's currency: the option list, the current code, and the write.
 * `updateAccount`, NOT `updateSettings` — the server denominates an unnamed
 * cost from `User.preferredCurrency`, so writing the `UserSettings` column of
 * the same name moves a value nothing reads.
 */
export function useCurrencyPreference() {
  const { t } = useTranslation();
  const preferredCurrency = usePreferredCurrency();
  const setPreferredCurrency = useAppStore(state => state.setPreferredCurrency);
  const { data } = useQuery(GetCurrenciesDocument);
  const [updateAccount, { loading: saving }] = useMutation(
    UpdateAccountDocument,
  );

  const options: CurrencyOption[] = (data?.currencies ?? []).map(currency => ({
    value: currency.code,
    // Deliberately unlocalized: a currency's name and symbol are its own, and
    // the code disambiguates the dollars and the kronor from each other.
    label: `${currency.code} — ${currency.name} (${currency.symbol})`,
  }));

  // The picker needs the full name to tell two dollars apart; a settings row
  // has one line beside its label, where the name only truncates.
  const selected = data?.currencies?.find(c => c.code === preferredCurrency);
  const currentLabel = selected
    ? `${selected.code} (${selected.symbol})`
    : preferredCurrency;

  const writeCurrency = async (code: string): Promise<boolean> => {
    const previous = preferredCurrency;
    // Ahead of the round trip so the money on screen re-denominates at once;
    // reverted below if the server refuses.
    setPreferredCurrency(code);

    const result = await updateAccount({
      variables: { input: { preferredCurrency: code } },
    });

    const payload = result.data?.updateAccount;
    if (payload?.__typename === 'UpdateAccountPayload') return true;

    setPreferredCurrency(previous);
    alertIfRejected(result, t('settings.updateFailed'));
    return false;
  };

  /**
   * Confirmed, because the change is not retroactive: costs already recorded
   * keep their own currency, so a pantry can end up spanning two and the API
   * withholds its value rather than summing across them. Said here, where the
   * decision is made, rather than discovered later on a blank total.
   */
  const selectCurrency = (code: string): void => {
    if (code === preferredCurrency) return;
    alertService.alert(
      t('labels.currency'),
      t('settings.currencyKeepsExisting'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.confirm'),
          onPress: () => {
            writeCurrency(code).catch(() => {
              // writeCurrency reverts and alerts on its own; nothing to add.
            });
          },
        },
      ],
    );
  };

  return { preferredCurrency, currentLabel, options, selectCurrency, saving };
}
