import { useQuery } from '@apollo/client/react';
import { useMoney } from '#domain/money';
import { useReceiptDraft } from '../store/receiptDraftStore';
import { ReceiptCurrenciesDocument } from './useReceiptCurrency.generated';

/**
 * The currency the receipt prints, where the API books it. Undefined for none
 * printed, one the API does not book, or a list not yet read: the check-in
 * then names none, so the API books it as it books any receipt without one.
 */
export function useReceiptCurrency(): string | undefined {
  const printed = useReceiptDraft()?.parsed?.currency;
  const { data } = useQuery(ReceiptCurrenciesDocument, {
    fetchPolicy: 'cache-first',
  });
  return data?.currencies.some(({ code }) => code === printed)
    ? printed
    : undefined;
}

/** Formats the receipt's figures in the currency it is booked in. */
export function useReceiptMoney(): (
  amount: number | null | undefined,
) => string {
  const money = useMoney();
  const currency = useReceiptCurrency();
  return amount => money(amount, currency ? { code: currency } : null);
}
