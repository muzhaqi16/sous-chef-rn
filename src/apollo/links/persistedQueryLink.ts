import type { DocumentNode } from 'graphql';
import { ApolloLink } from '@apollo/client';
import { PersistedQueryLink } from '@apollo/client/link/persisted-queries';
import {
  generatePersistedQueryIdsAtRuntime,
  sortTopLevelDefinitions,
} from '@apollo/persisted-query-lists';
import { sha256 } from 'js-sha256';

/**
 * Reorders a document's top-level definitions (operation first, then fragments
 * by name) so the text that goes on the wire is the text that was hashed.
 *
 * `generatePersistedQueryIdsAtRuntime` hashes
 * sha256(print(sortTopLevelDefinitions(document))) to match how the manifest
 * generator derives its ids, but `HttpLink` serializes `operation.query`
 * as-is. Codegen emits fragments in reference order, so for any operation
 * spreading two or more fragments whose reference order isn't alphabetical
 * (GetPantry, GetHome, GetRecipe, UpdateRecipe, …) the printed body hashes to
 * something other than the hash sent beside it. Standard APQ registration
 * recomputes sha256 over the body it receives, so the server rejects the
 * registration retry with "provided sha does not match query" and the
 * operation never completes. Sorting before both links makes hash, wire body,
 * and manifest id derive from one identical string.
 *
 * Memoized on document identity: Apollo hands the same transformed
 * `DocumentNode` object to the link chain on every execution of an operation,
 * and `PersistedQueryLink` caches hashes in a `WeakMap` keyed by that object —
 * returning a fresh copy per request would re-run sha256 over the full
 * document every time.
 */
const sortedDocuments = new WeakMap<DocumentNode, DocumentNode>();

function sortDefinitions(document: DocumentNode): DocumentNode {
  const cached = sortedDocuments.get(document);
  if (cached) {
    return cached;
  }
  const sorted = sortTopLevelDefinitions(document);
  sortedDocuments.set(document, sorted);
  // Sorting is idempotent — map the result to itself so a document that
  // re-enters the chain already sorted doesn't allocate a second copy.
  sortedDocuments.set(sorted, sorted);
  return sorted;
}

const sortDefinitionsLink = new ApolloLink((operation, forward) => {
  operation.query = sortDefinitions(operation.query);
  return forward(operation);
});

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
 * hash-only. That retry is why `sortDefinitionsLink` has to run first — see
 * its comment. The safelist plugin (when enabled) checks this same hash
 * against the manifest, so operations keep working the moment the server flips
 * `ENABLE_OPERATION_SAFELIST` — provided the shipped manifest was regenerated
 * with the release (`npm run codegen` does this).
 *
 * js-sha256 is used because Hermes has no WebCrypto; it's pure JS, so the same
 * code path runs in the app and under jest.
 */
export const persistedQueryLink = ApolloLink.from([
  sortDefinitionsLink,
  new PersistedQueryLink(
    generatePersistedQueryIdsAtRuntime({
      sha256: (data: string) => sha256(data),
    }),
  ),
]);
