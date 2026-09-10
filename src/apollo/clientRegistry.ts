/**
 * The Apollo client, reachable without importing `client.ts` — a direct import
 * closes `client → links → queue → client`. The singleton registers itself here
 * at init; everything downstream reads the reference at CALL time.
 */
import type { ApolloClient } from '@apollo/client';

let apolloClient: ApolloClient | null = null;

export const registerApolloClient = (instance: ApolloClient): void => {
  apolloClient = instance;
};

/** Null only before `client.ts` has evaluated, which is before anything runs. */
export const getApolloClient = (): ApolloClient | null => apolloClient;

/** Test seam: forget the registration. */
export const clearApolloClient = (): void => {
  apolloClient = null;
};
