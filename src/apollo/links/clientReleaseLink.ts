import { ApolloLink } from '@apollo/client';
import { tap } from 'rxjs';
import { useStore } from '#store';
import { announceClientReleaseAvailable } from '../clientUpgradeNotice';

// The version gate refuses before Apollo runs, with a 426; a 2xx passed it. A
// result errorLink answers from the cache after a network failure carries none.
const passedVersionGate = (response: unknown): boolean =>
  typeof response === 'object' &&
  response !== null &&
  'ok' in response &&
  response.ok === true;

/**
 * The server attaches `extensions.clientRelease` only when it can show this
 * build is behind, so PRESENCE is the whole signal — nothing here compares
 * versions. Deliberately off the error channel: under `errorPolicy: 'all'`
 * anything in `errors` reaches every hook's `error`.
 */
const readRecommendedVersion = (
  extensions: Record<string, unknown> | undefined,
): string | null => {
  const release = extensions?.clientRelease;
  if (!release || typeof release !== 'object') return null;

  // `minimum` also rides along when a floor is configured. It is deliberately
  // unused: the client already knows it is ABOVE the floor (it wasn't refused),
  // so the field's presence says a floor exists — not that this build is near
  // it. Escalating the copy on that would be inventing urgency the payload
  // doesn't carry.
  const { recommended } = release as { recommended?: unknown };
  return typeof recommended === 'string' && recommended ? recommended : null;
};

export const createClientReleaseLink = () =>
  new ApolloLink((operation, forward) =>
    forward(operation).pipe(
      tap(result => {
        const response: unknown = operation.getContext().response;
        if (passedVersionGate(response)) {
          useStore.getState().clearClientUpgradeRequired();
        }
        const recommended = readRecommendedVersion(result.extensions);
        if (recommended) announceClientReleaseAvailable(recommended);
      }),
    ),
  );
