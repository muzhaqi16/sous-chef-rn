/**
 * The gate `authLink` and `errorLink` read to refuse operations while a session
 * ends. A leaf module because the store and the Apollo links both hold it and
 * neither may import the other — the cycle `sessionTeardown.ts` documents.
 *
 * Counted: a sign-out and a server-ended session can overlap, and an inner
 * release must not open the gate an outer pass is still running under.
 */
let openScopes = 0;

export const isSessionEnding = (): boolean => openScopes > 0;

/** Holds the gate for the whole of `run`, however it exits. */
export const whileSessionEnds = async <T>(
  run: () => Promise<T>,
): Promise<T> => {
  openScopes += 1;
  try {
    return await run();
  } finally {
    openScopes = Math.max(0, openScopes - 1);
  }
};

/** Test seam: drop every scope. */
export const resetSessionEndingGate = (): void => {
  openScopes = 0;
};
