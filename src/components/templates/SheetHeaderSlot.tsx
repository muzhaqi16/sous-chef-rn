import React, {
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createValueContext } from '#hooks/utils/createValueContext';

/** One sheet's bar, as the content that owns it last rendered it. */
export interface SheetHeaderStore {
  set: (header: ReactNode) => void;
  get: () => ReactNode;
  subscribe: (listener: () => void) => () => void;
}

function createSheetHeaderStore(): SheetHeaderStore {
  let header: ReactNode = null;
  const listeners = new Set<() => void>();
  return {
    set: next => {
      header = next;
      listeners.forEach(listener => {
        listener();
      });
    },
    get: () => header,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const HeaderStoreContext =
  createValueContext<SheetHeaderStore>('SheetHeaderStore');

/** `Sheet`'s side: one store per sheet, for its content to fill. */
export function useSheetHeaderStore(): SheetHeaderStore {
  const [store] = useState(createSheetHeaderStore);
  return store;
}

export const SheetHeaderStoreProvider = HeaderStoreContext.Provider;

/** Where `Sheet` holds the bar its content sets; only this re-renders. */
export const SheetHeaderOutlet: React.FC<{ store: SheetHeaderStore }> = ({
  store,
}) => <>{useSyncExternalStore(store.subscribe, store.get)}</>;

/**
 * Renders a bar in the enclosing `Sheet`'s header slot, for content that owns
 * the bar's handlers, such as a form keyed per opening. The sheet opts in with
 * `headerFromContent`; outside such a sheet this throws.
 */
export const SheetHeaderSlot: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const store = HeaderStoreContext.useValue();
  // Every render: the bar closes over the content's latest handlers.
  useLayoutEffect(() => {
    store.set(children);
  });
  useLayoutEffect(
    () => () => {
      store.set(null);
    },
    [store],
  );
  return null;
};
