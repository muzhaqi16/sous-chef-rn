import { extractNodes } from '#/utils/connectionUtils';

/**
 * A home's pantries, whichever shape the caller holds.
 *
 * `GetHomes` selects `pantriesConnection`, so that is the branch that resolves
 * for anything the query returned. The flat `{ pantries }` shape is the one
 * some callers and fixtures hand in instead, and reading only `pantries`
 * against a connection-shaped node yields nothing — which is how a home switch
 * came to clear the pantry and wait on the server's `defaultPantry` to put one
 * back.
 *
 * Lives here rather than in either hook because `useDefaultHome` and
 * `useHomeSelection` both need it, and importing one from the other drags that
 * hook's store dependencies into the other's tests.
 */
export type HomePantries = {
  pantriesConnection?: {
    edges?: Array<{ node?: { id: string; isDefault?: boolean } | null } | null>;
  } | null;
};

/** The flat shape some callers (and fixtures) pass instead of the connection. */
export type FlatHome = {
  pantries?: Array<{ id: string; isDefault?: boolean }>;
};

export const pantriesOf = (home: HomePantries | FlatHome | undefined) => {
  if (!home) return [];
  const connection =
    'pantriesConnection' in home ? home.pantriesConnection : undefined;
  const fromConnection = extractNodes(connection) as Array<{
    id: string;
    isDefault?: boolean;
  }>;
  if (fromConnection.length) return fromConnection;
  const flat = 'pantries' in home ? home.pantries : undefined;
  return Array.isArray(flat) ? flat : [];
};

/**
 * The home's default pantry — the one flagged `isDefault`, else the first.
 * A HINT for an optimistic switch; the server's `defaultPantry` is the
 * authority and overwrites it when the mutation resolves.
 */
export const defaultPantryOf = (home: HomePantries | FlatHome | undefined) => {
  const pantries = pantriesOf(home);
  return pantries.find(p => p.isDefault) ?? pantries[0];
};
