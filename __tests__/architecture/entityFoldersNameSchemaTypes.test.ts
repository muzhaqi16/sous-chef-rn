import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildSchema, isObjectType, type GraphQLSchema } from 'graphql';

/**
 * An entity folder holds what 2+ features write about ONE schema type, so its
 * name is that type's: a grab-bag folder (`catalog`) hides which entity a
 * writer belongs to and collects unrelated ones.
 */

const ENTITIES = path.join(__dirname, '../../src/entities');

const schema = buildSchema(
  fs.readFileSync(
    path.join(__dirname, '../../src/graphql/generated/schema.graphql'),
    'utf8',
  ),
);

/** Each folder whose name is not a schema object type, camelCased. */
function foldersNamingNoType(
  folders: readonly string[],
  against: GraphQLSchema,
): string[] {
  return folders.filter(folder => {
    const typeName = folder.charAt(0).toUpperCase() + folder.slice(1);
    return !isObjectType(against.getType(typeName));
  });
}

describe('an entity folder names one schema type', () => {
  it('catches a folder named for no type', () => {
    expect(foldersNamingNoType(['catalog', 'storageLocation'], schema)).toEqual(
      ['catalog'],
    );
  });

  it('holds for every folder', () => {
    const folders = fs
      .readdirSync(ENTITIES, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
    expect(folders.length).toBeGreaterThan(3);

    expect(foldersNamingNoType(folders, schema)).toEqual([]);
  });
});
