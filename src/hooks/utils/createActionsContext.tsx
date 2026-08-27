import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** Any callback an actions bag can hold. */
type AnyAction = (...args: never[]) => unknown;

/**
 * Builds a "stable actions" context: a provider, a hook that throws outside it,
 * and an optional hook that does not.
 *
 * ## Why a factory
 *
 * Six of these were written by hand — `PantryActionsContext`,
 * `FilteredItemsActionsContext`, `ShoppingListTabsActionsContext`,
 * `SortableListActionsContext`, `InviteActionsContext`, `ItemListActionsContext`
 * — each ~50-150 lines of the same three parts.
 *
 * The part worth sharing is not `createContext`; it is the stabilisation. A list
 * row reads its callbacks from context, so if the context VALUE changes identity
 * on every parent render, every row re-renders. The fix is to keep the latest
 * callbacks in a ref and hand consumers a set of delegating wrappers built once.
 * Easy to describe, easy to get subtly wrong, and it was repeated verbatim.
 *
 * ## Two constraints this encodes
 *
 * - The wrappers are built in a `useState` initializer, not during render.
 *   `ref.current` must not be read or written while rendering (CLAUDE.md), and
 *   `useMemo` is lint-banned here because the React Compiler owns memoization.
 * - The wrapper set is fixed from the FIRST `actions` object. A key added later
 *   would have no wrapper. That matches what the hand-written versions did —
 *   they listed their keys as literals — and every actions bag in this app has a
 *   fixed shape.
 *
 * ## What it does not cover
 *
 * Only callbacks. A context that also carries reactive VALUES (a permissions
 * object, an `accepting` flag) must pass those separately, because the whole
 * point here is that the value never changes identity.
 */
export function createActionsContext<TActions extends object>(
  displayName: string,
) {
  // `object`, not `Record<string, AnyAction>`: an `interface` has no implicit
  // index signature, so the stricter constraint would reject every caller and
  // force them all to become `type` aliases. The two casts below are the price,
  // and they are confined to this file.
  type ActionBag = Record<string, AnyAction | undefined>;
  const Context = createContext<TActions | null>(null);
  Context.displayName = displayName;

  const Provider: React.FC<{ actions: TActions; children: ReactNode }> = ({
    actions,
    children,
  }) => {
    const latest = useRef(actions);
    useEffect(() => {
      latest.current = actions;
    });

    const [stable] = useState(() =>
      Object.fromEntries(
        Object.keys(actions).map(key => [
          key,
          (...args: never[]) => (latest.current as ActionBag)[key]?.(...args),
        ]),
      ),
    );

    return (
      <Context.Provider value={stable as TActions}>{children}</Context.Provider>
    );
  };

  const useActions = (): TActions => {
    const value = useContext(Context);
    if (!value) {
      throw new Error(`${displayName} is missing its provider`);
    }
    return value;
  };

  const useOptionalActions = (): TActions | null => useContext(Context);

  return { Provider, useActions, useOptionalActions };
}
