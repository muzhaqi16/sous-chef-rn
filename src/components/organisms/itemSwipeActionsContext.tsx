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

/**
 * Publishes a factory to the rows below, and PASSES THROUGH when given none.
 *
 * The lists render this for their own optional prop and sit inside the one the
 * screen renders, so a plain context provider had the inner publish `undefined`
 * and shadow the outer — every shopping-list row lost swipe-to-edit and
 * swipe-to-delete, with nothing to catch it: each prop along the way is
 * optional, so a layer that forwards nothing type-checks.
 *
 * Passing through is the right reading of "no factory": a list that supplies
 * none is not asserting there are none, it simply has no opinion. A list that
 * genuinely wants different actions supplies its own, which still wins.
 */
export const ItemSwipeActionsProvider = ({
  value,
  children,
}: {
  value: ItemSwipeActionsFactory | undefined;
  children: React.ReactNode;
}) =>
  value === undefined ? (
    <>{children}</>
  ) : (
    <context.Provider value={value}>{children}</context.Provider>
  );

/** `undefined` when no screen supplied a factory, or outside a provider. */
export const useItemSwipeActions = (): ItemSwipeActionsFactory | undefined =>
  context.useOptionalValue() ?? undefined;
