'use no memo';

import type { OperationVariables } from '@apollo/client';
import { APOLLO_DEFAULT_OPTIONS } from '#apollo/defaultOptions';
import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { print } from 'graphql';
import { sha256 } from 'js-sha256';
import { Observable } from 'rxjs';
import { persistedQueryLink } from '../persistedQueryLink';
import { operationNameOf } from '#apollo/utils/documentOperation';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { GetHomeDocument } from '#features/home/screens/useHomeDetailManagement.generated';

interface CapturedRequest {
  name: string;
  sha256Hash: string | undefined;
  /** Exactly what HttpLink would serialize into the request's `query` field. */
  body: string;
}

function buildCapturingClient(captured: CapturedRequest[]) {
  const terminating = new ApolloLink(operation => {
    const persisted = operation.extensions.persistedQuery as
      | { sha256Hash?: string }
      | undefined;
    captured.push({
      name: operation.operationName ?? '',
      sha256Hash: persisted?.sha256Hash,
      body: print(operation.query),
    });
    return new Observable(observer => {
      observer.next({ data: null });
      observer.complete();
    });
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([persistedQueryLink, terminating]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
}

describe('persistedQueryLink', () => {
  // Variables never affect the document hash — only the printed query does,
  // which is why the documents are deliberately plain `DocumentNode`s here.
  // `variables` is typed rather than inferred so the three entries widen at the
  // definition site instead of forming a union: under Apollo 4.2's modern
  // signatures a union of variables does not satisfy `client.query`.
  const CASES: Array<{
    operationName: string;
    document: import('graphql').DocumentNode;
    variables: OperationVariables;
  }> = [
    {
      operationName: operationNameOf(GetUnreadNotificationsDocument),
      document: GetUnreadNotificationsDocument,
      variables: {},
    },
    {
      // Deep fragment composition — exercises fragment ordering, which
      // sortTopLevelDefinitions must neutralize on both sides.
      operationName: operationNameOf(GetPantryDocument),
      document: GetPantryDocument,
      variables: { id: 'pantry-1' },
    },
    {
      // Codegen emits this one's fragments in an order that differs from the
      // sorted order, so its body hashes to its hash only once the document
      // reaching HttpLink has been sorted.
      operationName: operationNameOf(GetHomeDocument),
      document: GetHomeDocument,
      variables: { id: 'home-1' },
    },
  ];

  it.each(CASES)(
    'body sent for $operationName hashes to the hash sent beside it',
    async ({ document, variables }) => {
      // APQ registration: when the hash-only request misses, the retry carries
      // the full body and the server recomputes sha256 over it. A body that
      // hashes to anything else is rejected with "provided sha does not match
      // query" and the operation never completes.
      const captured: CapturedRequest[] = [];
      const client = buildCapturingClient(captured);

      await client
        .query({
          query: document,
          variables,
          fetchPolicy: 'no-cache',
          errorPolicy: 'ignore',
        })
        .catch(() => undefined);

      expect(captured[0]!.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256(captured[0]!.body)).toBe(captured[0]!.sha256Hash);
    },
  );
});
