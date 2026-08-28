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
 * - A wrapper exists only for a key whose value is DEFINED. Building one for
 *   every key of `actions` hands consumers a truthy function for a handler that
 *   is `undefined`, and consumers gate their affordances on truthiness
 *   (`canEditItems && onItemEdit`) — so the control renders and the tap does
 *   nothing. That is a dead button, not a disabled one.
 * - The wrapper set follows the CURRENT actions bag. It is rebuilt when the set
 *   of defined keys changes, and only then, so the context value keeps a stable
 *   identity across the renders where nothing became available or unavailable.
 *   Freezing it at the first render loses a key that arrives later:
 *   `FilteredPantryItems` spreads its cart action in behind
 *   `showCartAction && permissions.canAddItems`, and permissions arrive from a
 *   query after the provider's first render.
 *
 * The rebuild uses the adjusting-state-during-render pattern rather than
 * `useMemo` (lint-banned here — the React Compiler owns memoization) and never
 * reads `latest.current` during render, only closes over it.
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

    // Only keys carrying a real handler get a wrapper; see the header comment.
    const definedKeys = Object.keys(actions).filter(
      key => (actions as ActionBag)[key] !== undefined,
    );
    // Identity of the available set, so a rebuild happens when a handler
    // appears or disappears and at no other time.
    const signature = [...definedKeys].sort().join(',');

    const buildWrappers = () =>
      Object.fromEntries(
        definedKeys.map(key => [
          key,
          (...args: never[]) => (latest.current as ActionBag)[key]?.(...args),
        ]),
      );

    const [derived, setDerived] = useState(() => ({
      signature,
      wrappers: buildWrappers(),
    }));

    // Adjusting state during render: React re-runs this component with the new
    // state immediately, and `current` keeps THIS pass from using the stale set.
    let current = derived;
    if (derived.signature !== signature) {
      current = { signature, wrappers: buildWrappers() };
      setDerived(current);
    }

    return (
      <Context.Provider value={current.wrappers as TActions}>
        {children}
      </Context.Provider>
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
