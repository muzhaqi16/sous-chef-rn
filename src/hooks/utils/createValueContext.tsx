import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * Builds a context for a value a consumer reads WHILE RENDERING.
 *
 * The counterpart to {@link createActionsContext}, and the distinction is the
 * point. That factory stabilises COMMANDS — fire-and-forget callbacks invoked
 * from event handlers — by holding the latest bag in a ref, so the context value
 * keeps one identity and rows do not re-render when a parent re-renders. That is
 * correct for a command, because by the time one is invoked the ref is current.
 *
 * It is wrong for a DERIVATION: something a row calls during render and reads a
 * value from, such as the factory that builds a row's swipe actions. The ref is
 * published after children render — and after their effects, since a child's
 * effects flush before its parent's — so a row resolving a derivation through it
 * builds itself from the previous render's data. When the screen changed which
 * list it was showing, rows kept the old list's handlers.
 *
 * Here the value IS the value. A change re-renders consumers, which is not a
 * cost being reintroduced but the re-render correctness requires: it happens
 * exactly when the thing the row renders has changed. Keep identity stable at
 * the source (the React Compiler already memoizes an inline factory on its real
 * dependencies) rather than by hiding changes behind a ref.
 */
export function createValueContext<TValue>(displayName: string) {
  const Context = createContext<TValue | null>(null);
  Context.displayName = displayName;

  const Provider: React.FC<{ value: TValue; children: ReactNode }> = ({
    value,
    children,
  }) => <Context.Provider value={value}>{children}</Context.Provider>;

  /** Throws outside a provider, so a missing one is not a silent `undefined`. */
  const useValue = (): TValue => {
    const value = useContext(Context);
    if (value === null) {
      throw new Error(`${displayName} is missing its provider`);
    }
    return value;
  };

  /** For a consumer that legitimately renders outside the provider. */
  const useOptionalValue = (): TValue | null => useContext(Context);

  return { Provider, useValue, useOptionalValue };
}
