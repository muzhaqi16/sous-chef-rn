import { ApolloLink } from '@apollo/client';
import { tap } from 'rxjs';
import { announceClientReleaseAvailable } from '../clientUpgradeNotice';

/**
 * Reads the server's soft "a newer build exists" signal off ordinary
 * successful responses.
 *
 * The server attaches `extensions.clientRelease` in `willSendResponse` only
 * when it can show this build is behind the recommended release, so PRESENCE is
 * the signal — this link never compares versions, and there is no semver
 * dependency to disagree with the server's.
 *
 * The counterpart hard refusal (`CLIENT_UPGRADE_REQUIRED` / WS close 4411)
 * rides the error channel and is handled in `errorLink` / `wsLink`. Keeping the
 * soft signal off that channel is deliberate on both sides: under the global
 * `errorPolicy: 'all'` anything in `errors` reaches every hook's `error`, and a
 * non-error travelling there teaches callers to treat refusals as noise.
 *
 * Placement mirrors `networkStatusLink` — above `retryLink` so retries are
 * absorbed and this sees one result per operation, and below `offlineModeLink`
 * so cache-served responses (which carry no server extensions) never reach it.
 * HTTP only in practice: the server attaches this in the HTTP response path,
 * and subscription payloads don't carry it.
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
        const recommended = readRecommendedVersion(result.extensions);
        if (recommended) announceClientReleaseAvailable(recommended);
      }),
    ),
  );
