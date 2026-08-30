import type { DocumentNode } from 'graphql';
import { ApolloLink } from '@apollo/client';
import { PersistedQueryLink } from '@apollo/client/link/persisted-queries';
import {
  generatePersistedQueryIdsAtRuntime,
  sortTopLevelDefinitions,
} from '@apollo/persisted-query-lists';
import { sha256 } from 'js-sha256';

/**
 * Reorders top-level definitions so the text on the wire is the text that was
 * hashed — codegen emits fragments in reference order while the hash sorts
 * them, so the APQ registration retry is otherwise rejected as "provided sha
 * does not match query". Memoized on document identity to avoid re-hashing.
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
 * Persisted queries for HTTP. The hash is computed at runtime from the document
 * being executed, so it cannot drift from the shipped code. Standard APQ: hash
 * only, then a retry carrying the body, which is why `sortDefinitionsLink` runs
 * first. js-sha256 because Hermes has no WebCrypto.
 */
export const persistedQueryLink = ApolloLink.from([
  sortDefinitionsLink,
  new PersistedQueryLink(
    generatePersistedQueryIdsAtRuntime({
      sha256: (data: string) => sha256(data),
    }),
  ),
]);
