import React, {
  createContext,
  useEffect,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** Any callback an actions bag can hold. */
type AnyAction = (...args: never[]) => unknown;

/**
 * Same parameters, NO return value — what makes "commands only" a rule tsc
 * enforces. A derivation read during render would resolve through a ref
 * published after children render; voiding the return makes that fail to compile
 * rather than go stale. Derivations belong in {@link createValueContext}.
 */
type Commandify<T> = T extends (...args: infer TArgs) => unknown
  ? (...args: TArgs) => void
  : T;

/** The bag as consumers see it: every callback reduced to a command. */
export type Commands<TActions> = {
  [K in keyof TActions]: Commandify<TActions[K]>;
};

/**
 * A "stable actions" context: latest callbacks in a ref, consumers given
 * delegating wrappers, so a parent re-render does not re-render every row.
 * CALLBACKS ONLY — a reactive value passed here would never change identity.
 * See the two constraints noted at `definedKeys` and `signature` below.
 */
export function createActionsContext<TActions extends object>(
  displayName: string,
) {
  // `object`, not `Record<string, AnyAction>`: an `interface` has no implicit
  // index signature, so the stricter constraint would reject every caller. The
  // two casts below are the price, confined to this file.
  type ActionBag = Record<string, AnyAction | undefined>;
  const Context = createContext<Commands<TActions> | null>(null);
  Context.displayName = displayName;

  const Provider: React.FC<{ actions: TActions; children: ReactNode }> = ({
    actions,
    children,
  }) => {
    const latest = useRef(actions);
    useEffect(() => {
      latest.current = actions;
    });

    // ONLY a defined key gets a wrapper: consumers gate affordances on
    // truthiness (`canEditItems && onItemEdit`), so a wrapper over `undefined`
    // renders a dead button rather than a disabled one.
    const definedKeys = Object.keys(actions).filter(
      key => (actions as ActionBag)[key] !== undefined,
    );
    // Rebuilt when a handler appears or disappears and never else — freezing the
    // set at first render loses a key that arrives with a permissions query.
    const signature = [...definedKeys].sort().join(',');

    const buildWrappers = () =>
      Object.fromEntries(
        definedKeys.map(key => [
          key,
          // Discards the result deliberately — the runtime must agree with the
          // `void` type, or a cast could read a stale ref value.
          (...args: never[]) => {
            (latest.current as ActionBag)[key]?.(...args);
          },
        ]),
      );

    const [derived, setDerived] = useState(() => ({
      signature,
      wrappers: buildWrappers(),
    }));

    // Adjusting state during render; `current` keeps THIS pass off the stale set.
    let current = derived;
    if (derived.signature !== signature) {
      current = { signature, wrappers: buildWrappers() };
      setDerived(current);
    }

    return (
      <Context.Provider value={current.wrappers as Commands<TActions>}>
        {children}
      </Context.Provider>
    );
  };

  const useActions = (): Commands<TActions> => {
    const value = useContext(Context);
    if (!value) {
      throw new Error(`${displayName} is missing its provider`);
    }
    return value;
  };

  const useOptionalActions = (): Commands<TActions> | null =>
    useContext(Context);

  return { Provider, useActions, useOptionalActions };
}
