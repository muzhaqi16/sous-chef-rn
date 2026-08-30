import { createValueContext } from '#hooks/utils/createValueContext';
import type { ItemSwipeActionsFactory } from '#components/molecules/SwipeableItem/types';

/**
 * The per-row swipe-action factory a screen supplies to its list. A context VALUE,
 * not a member of the row-actions bag: a row calls it during render, so it must be
 * current, where the bag stabilises commands behind a ref published afterwards.
 * Optional by design — rows with no swipe actions are not a missing provider.
 */
const context = createValueContext<ItemSwipeActionsFactory | undefined>(
  'ItemSwipeActionsProvider',
);

/**
 * Publishes a factory to the rows below, and PASSES THROUGH when given none. Lists
 * render this inside the screen's own, so a plain provider would publish
 * `undefined` and shadow the outer one — silently, since every prop on the way is
 * optional. A list supplying none has no opinion; one supplying its own still wins.
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
