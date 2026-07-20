'use no memo';

/**
 * Guards the operation-safelist identity: the hash `persistedQueryLink` sends
 * at runtime must equal the id `scripts/generate-pq-manifest.mjs` wrote into
 * persisted-query-manifest.json for the same operation. If these ever drift
 * (codegen change, transform change, tooling upgrade), the server rejects
 * every operation with OPERATION_NOT_ALLOWED the moment
 * ENABLE_OPERATION_SAFELIST flips — this test fails first.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { Observable } from 'rxjs';
import { persistedQueryLink } from '../persistedQueryLink';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

interface ManifestOperation {
  id: string;
  name: string;
  type: string;
  body: string;
}

const manifest: { operations: ManifestOperation[] } = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../persisted-query-manifest.json'),
    'utf8',
  ),
);

interface CapturedRequest {
  name: string;
  sha256Hash: string | undefined;
}

function buildCapturingClient(captured: CapturedRequest[]) {
  const terminating = new ApolloLink(operation => {
    const persisted = operation.extensions.persistedQuery as
      | { sha256Hash?: string }
      | undefined;
    captured.push({
      name: operation.operationName ?? '',
      sha256Hash: persisted?.sha256Hash,
    });
    return new Observable(observer => {
      observer.next({ data: null });
      observer.complete();
    });
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([persistedQueryLink, terminating]),
  });
}

describe('persistedQueryLink ↔ manifest identity', () => {
  // Variables never affect the document hash — only the printed query does.
  const CASES = [
    {
      operationName: 'GetUnreadNotifications',
      document:
        GetUnreadNotificationsDocument as import('graphql').DocumentNode,
      variables: {},
    },
    {
      // Deep fragment composition — exercises fragment ordering, which
      // sortTopLevelDefinitions must neutralize on both sides.
      operationName: 'GetPantry',
      document: GetPantryDocument as import('graphql').DocumentNode,
      variables: { id: 'pantry-1' },
    },
  ];

  it.each(CASES)(
    'runtime hash for $operationName equals the manifest id',
    async ({ operationName, document, variables }) => {
      const manifestEntry = manifest.operations.find(
        op => op.name === operationName,
      );
      expect(manifestEntry).toBeDefined();

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

      expect(captured.length).toBeGreaterThan(0);
      expect(captured[0].sha256Hash).toBe(manifestEntry!.id);
    },
  );

  it('every manifest id is a sha256 hex digest', () => {
    expect(manifest.operations.length).toBeGreaterThan(200);
    for (const op of manifest.operations) {
      expect(op.id).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
