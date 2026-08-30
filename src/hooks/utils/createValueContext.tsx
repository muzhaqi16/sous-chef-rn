import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * A context for a value read WHILE RENDERING, where the value IS the value.
 * {@link createActionsContext}'s ref-stabilisation is right for commands and
 * WRONG here: the ref publishes after children render, so a row would build from
 * the previous render's data. Keep identity stable at the source instead.
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
