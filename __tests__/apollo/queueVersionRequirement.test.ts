import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSchema,
  Kind,
  isInputObjectType,
  isNonNullType,
  type GraphQLSchema,
  type OperationDefinitionNode,
} from 'graphql';
import { syncMappedOperations } from '#/apollo/offlineQueue/convertToSyncMutation';
import { VERSION_REQUIRED_OPERATIONS } from '#/apollo/offlineQueue/queueManager';
import {
  SRC,
  authoredMutations,
  localFirstOperationNames,
} from '#/test-utils/queueableOperations';

/**
 * On a version conflict the queue strips `version` and re-sends once. That is
 * only a valid request where the replayed input lets `version` be omitted; a
 * Sync twin always does, an original document may not. The manager's table of
 * the ones that do not is hand-written, so it is pinned to the SDL here.
 */
function requiresVersion(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode,
): boolean {
  const mutationType = schema.getMutationType();
  if (!mutationType) return false;
  for (const selection of operation.selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) continue;
    const field = mutationType.getFields()[selection.name.value];
    if (!field) continue;
    for (const arg of field.args) {
      let type = arg.type;
      while ('ofType' in type && type.ofType) type = type.ofType;
      if (!isInputObjectType(type)) continue;
      const version = type.getFields().version;
      if (version && isNonNullType(version.type)) return true;
    }
  }
  return false;
}

describe('the version-required table matches the SDL', () => {
  const schema = buildSchema(
    fs.readFileSync(
      path.join(SRC, 'graphql', 'generated', 'schema.graphql'),
      'utf8',
    ),
  );
  const mutations = authoredMutations();
  const syncMapped = new Set(syncMappedOperations());
  // Only an operation replayed AS ITSELF can be refused for a missing version.
  const replayedAsIs = [...localFirstOperationNames()]
    .filter(name => mutations.has(name) && !syncMapped.has(name))
    .sort();

  it('finds enqueueable operations replayed as themselves', () => {
    expect(replayedAsIs.length).toBeGreaterThan(3);
  });

  it('lists exactly the replayed-as-is operations whose input requires version', () => {
    const fromSdl = replayedAsIs
      .filter(name => requiresVersion(schema, mutations.get(name)!))
      .sort();
    expect([...VERSION_REQUIRED_OPERATIONS].sort()).toEqual(fromSdl);
  });
});
