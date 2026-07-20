import { PersistedQueryLink } from '@apollo/client/link/persisted-queries';
import { generatePersistedQueryIdsAtRuntime } from '@apollo/persisted-query-lists';
import { sha256 } from 'js-sha256';

/**
 * Persisted-query link for the HTTP transport — the client half of the API's
 * operation-safelist contract (`docs/api/operation-safelisting.md` in the API
 * repo) and of APQ (enabled server-side, Redis-backed).
 *
 * The hash sent is sha256(print(sortTopLevelDefinitions(document))) — computed
 * at runtime from the very document being executed, which is BY CONSTRUCTION
 * the same id `@apollo/generate-persisted-query-manifest` writes into
 * `persisted-query-manifest.json` (both use the same sort + hash helpers). A
 * bundled manifest lookup was deliberately avoided: runtime ids can never
 * drift from the shipped code, and there is no manifest to forget to rebundle.
 *
 * Wire protocol (standard APQ): hash-only request first; on the server's
 * PersistedQueryNotFound, an automatic retry carries the full body + hash and
 * registers it (15-min Redis TTL server-side), so steady-state requests are
 * hash-only. The safelist plugin (when enabled) checks this same hash against
 * the manifest, so operations keep working the moment the server flips
 * `ENABLE_OPERATION_SAFELIST` — provided the shipped manifest was regenerated
 * with the release (`npm run codegen` does this).
 *
 * js-sha256 is used because Hermes has no WebCrypto; it's pure JS, so the same
 * code path runs in the app and under jest.
 */
export const persistedQueryLink = new PersistedQueryLink(
  generatePersistedQueryIdsAtRuntime({
    sha256: (data: string) => sha256(data),
  }),
);
