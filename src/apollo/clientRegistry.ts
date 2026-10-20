/**
 * The Apollo client, reachable without importing `client.ts` — a direct import
 * closes `client → links → queue → client` — and without knowing which host
 * built it. `createApolloClient` registers it; everything downstream reads the
 * reference at CALL time.
 */
import type { ApolloClient } from '@apollo/client';

let apolloClient: ApolloClient | null = null;

export const registerApolloClient = (instance: ApolloClient): void => {
  apolloClient = instance;
};

/** Null only before the host has built the client, which is before anything runs. */
export const getApolloClient = (): ApolloClient | null => apolloClient;

/** The client, for code that only ever runs after the host built it. */
export const requireApolloClient = (): ApolloClient => {
  if (!apolloClient) {
    throw new Error('Apollo client read before createApolloClient() ran');
  }
  return apolloClient;
};

/** @internal Test seam: forget the registration. */
export const clearApolloClient = (): void => {
  apolloClient = null;
};
