import { useEffect, useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { storeApi } from '#store';
import { useAppStore, useSelectedHomeId, useUser } from '#store/useAppStore';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { featureHintsSuppressed } from '#hooks/settings/useFeatureHint';
import { useIsScreenFocused } from '#hooks/utils/useIsScreenFocused';
import { onTutorialEvent } from '#domain/tutorialEvents';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { GettingStartedDocument } from './useGettingStarted.generated';

/** The first things worth doing, in the order the card lists them. */
export type GettingStartedItem = 'stock' | 'shop' | 'cook' | 'plan';

const ITEMS: GettingStartedItem[] = ['stock', 'shop', 'cook', 'plan'];

/** Both put food in the pantry, which some members of a home may not. */
const ADDS_TO_PANTRY: ReadonlySet<GettingStartedItem> = new Set([
  'stock',
  'shop',
]);

/**
 * The release that brought the card: an account older than it already knows
 * the app.
 */
const GETTING_STARTED_SINCE = '2026-11-10T00:00:00Z';

/**
 * Today's Getting started card for a new account. Each item is done from the
 * account's own activity, however it was done, and stays done on this device:
 * the pantry holds something, a bought item was moved to the pantry (seen on
 * this device), a recipe was cooked, a meal is planned. Null while the card is
 * not shown.
 */
export function useGettingStarted({
  pantryItemCount,
}: {
  /** The selected pantry's items, from Today's counts; null until read. */
  pantryItemCount: number | null;
}) {
  const user = useUser();
  const userId = user?.id;
  const flagOn = useFeatureFlag('gettingStarted');
  const record = useAppStore(state =>
    userId ? state.gettingStarted[userId] : undefined,
  );
  const homeId = useSelectedHomeId();
  const isFocused = useIsScreenFocused();
  const { canAddItems } = usePantryPermissions();

  const eligible =
    flagOn &&
    !!user?.createdAt &&
    !featureHintsSuppressed() &&
    Date.parse(user.createdAt) >= Date.parse(GETTING_STARTED_SINCE);
  // Once every item is done the card says so this visit, then retires.
  const [acknowledging, setAcknowledging] = useState(false);
  const showing =
    acknowledging || (eligible && !record?.hidden && !record?.retired);

  // Asked again each time Today shows, so what was done elsewhere ticks.
  const { data } = useQuery(
    GettingStartedDocument,
    showing && !acknowledging && isFocused && homeId
      ? {
          variables: { homeId },
          fetchPolicy: 'cache-and-network',
          nextFetchPolicy: 'cache-first',
        }
      : skipToken,
  );

  const seen = new Set(record?.done ?? []);
  const plannedMeal =
    data?.mealPlans.edges.some(
      ({ node }) => (node.mealPlanItemsConnection.totalCount ?? 0) > 0,
    ) ?? false;
  const doneNow: Record<GettingStartedItem, boolean> = {
    stock: (pantryItemCount ?? 0) > 0,
    shop: false,
    cook: (data?.me?.cookingStats?.totalRecipesCooked ?? 0) > 0,
    plan: plannedMeal,
  };
  const items = ITEMS.filter(id => canAddItems || !ADDS_TO_PANTRY.has(id)).map(
    id => ({ id, done: seen.has(id) || doneNow[id] }),
  );

  // Kept on the device, so a done item never reads as undone offline.
  const newlyDone = items
    .filter(item => item.done && !seen.has(item.id))
    .map(item => item.id)
    .join(',');
  useEffect(() => {
    if (!userId || newlyDone === '') return;
    storeApi.getState().markGettingStartedDone(userId, newlyDone.split(','));
  }, [userId, newlyDone]);

  // No server record says an item was put away, so the device notes it.
  useEffect(() => {
    if (!userId || !eligible) return;
    return onTutorialEvent(event => {
      if (event === 'list.movedToPantry') {
        storeApi.getState().markGettingStartedDone(userId, ['shop']);
      }
    });
  }, [userId, eligible]);

  // Said once, while Today shows; the next visit finds the card gone.
  const allDone = items.length > 0 && items.every(item => item.done);
  if (showing && allDone && !acknowledging && isFocused) {
    setAcknowledging(true);
  }
  if (acknowledging && !isFocused) setAcknowledging(false);
  useEffect(() => {
    if (acknowledging && userId) {
      storeApi.getState().retireGettingStarted(userId);
    }
  }, [acknowledging, userId]);

  return {
    card: showing
      ? {
          items,
          doneCount: items.filter(item => item.done).length,
          allDone,
        }
      : null,
    /** Hidden on this device until Replay tips. */
    hide: () => {
      if (userId) storeApi.getState().hideGettingStarted(userId);
    },
  };
}
