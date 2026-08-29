import { createValueContext } from '#hooks/utils/createValueContext';
import type { ItemSwipeActionsFactory } from '#components/molecules/SwipeableItem/types';

/**
 * The per-row swipe-action factory a screen supplies to whatever list renders
 * its rows.
 *
 * A context VALUE rather than a member of the row-actions bag: a row calls this
 * during render and renders what it returns, so it must be the current one. The
 * actions bag stabilises commands behind a ref published after children render,
 * which is correct for a command and stale for this.
 *
 * Optional by design — a list may render rows with no swipe actions at all, and
 * that is not a missing provider.
 */
const context = createValueContext<ItemSwipeActionsFactory | undefined>(
  'ItemSwipeActionsProvider',
);

export const ItemSwipeActionsProvider = context.Provider;

/** `undefined` when no screen supplied a factory, or outside a provider. */
export const useItemSwipeActions = (): ItemSwipeActionsFactory | undefined =>
  context.useOptionalValue() ?? undefined;
