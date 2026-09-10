/**
 * What a session end does to Apollo, without the store importing it — a static
 * import closes `store → resetManager → apollo/client → links → store`, and a
 * dynamic one is unreachable under Jest, which would leave clearing the
 * persisted cache untestable. Apollo registers these at client init.
 */

export interface ApolloResetBridge {
  /** The proactive refresh timer outlives the tokens it was scheduled for. */
  cancelTokenRefresh: () => void;
  /** The persisted blob, which survives a restart. */
  clearPersistedCache: () => void;
  /** The in-memory store. */
  clearStore: () => Promise<void>;
}

let bridge: ApolloResetBridge | null = null;

export const registerApolloResetBridge = (
  implementation: ApolloResetBridge,
): void => {
  bridge = implementation;
};

/** Null before `apollo/client.ts` evaluates, which is before a session exists. */
export const getApolloResetBridge = (): ApolloResetBridge | null => bridge;

/** Test seam: forget the registration. */
export const clearApolloResetBridge = (): void => {
  bridge = null;
};
