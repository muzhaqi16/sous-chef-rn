import { useEffect, useRef } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { useStore } from '#store';
import { useSelectedShoppingListId, useUser } from '#store/useAppStore';
import { alertService } from '#/services/alertService';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useUpdateSettings } from '#hooks/settings/useUpdateSettings';
import { useTranslation } from '#/i18n';
import { PricePromptReadinessDocument } from './usePricePrompt.generated';

/**
 * Asks once, when the list the user works in first has price data enough,
 * whether to show prices and savings. Either answer is kept with the account,
 * so no device asks again, and readiness is read only while the question is
 * open; a share-code reader has no readiness and is never asked. Mounted once
 * per session.
 */
export function usePricePrompt(): void {
  const { t } = useTranslation();
  const user = useUser();
  const offered = useFeatureFlag('budgetAndPrices');
  const listId = useSelectedShoppingListId();
  // The account's own answer, not the mirror's default before it is read.
  const { data } = useQuery(
    GetUserSettingsDocument,
    user?.id ? { fetchPolicy: 'cache-only' } : skipToken,
  );
  const unanswered = data?.me?.settings?.budgetAndPrices === null;
  const readiness = useQuery(
    PricePromptReadinessDocument,
    offered && unanswered && listId ? { variables: { id: listId } } : skipToken,
  );
  // `skipToken` keeps the last list's answer, so it must be this list's.
  const shown = readiness.data?.shoppingList;
  const enough = shown?.id === listId && shown.priceReadiness?.enough === true;
  const { updateSettings } = useUpdateSettings();
  const asked = useRef(false);

  const due = offered && unanswered && enough;
  useEffect(() => {
    // A carry-over in this same commit may have answered already.
    if (!due || asked.current || useStore.getState().budgetAndPrices !== null) {
      return;
    }
    asked.current = true;
    alertService.alert(
      t('shoppingListScreens.pricePrompt.title'),
      t('shoppingListScreens.pricePrompt.message'),
      [
        {
          text: t('labels.notNow'),
          style: 'cancel',
          onPress: () => {
            void updateSettings({ budgetAndPrices: false });
          },
        },
        {
          text: t('shoppingListScreens.pricePrompt.accept'),
          onPress: () => {
            void updateSettings({ budgetAndPrices: true });
          },
        },
      ],
    );
  }, [due, t, updateSettings]);
}
