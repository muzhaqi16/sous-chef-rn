import type { ApolloCache } from '@apollo/client';
import {
  SavedRecipeFoldersDocument,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { isRecord } from '#/utils/isRecord';

function readFolders(cache: ApolloCache): string[] | undefined {
  return (
    cache.readQuery<SavedRecipeFoldersQuery>({
      query: SavedRecipeFoldersDocument,
      optimistic: true,
    })?.savedRecipeFolders ?? undefined
  );
}

function writeFolders(cache: ApolloCache, folders: string[]): void {
  cache.writeQuery<SavedRecipeFoldersQuery>({
    query: SavedRecipeFoldersDocument,
    data: { __typename: 'Query', savedRecipeFolders: folders },
  });
}

/**
 * Moves every cached `SavedRecipe` from `from` to `to`. The screen filters on
 * each recipe's `folder`, so rewriting only the folder LIST empties the folder.
 */
function rewriteSavedRecipeFolders(
  cache: ApolloCache,
  from: string,
  to: string | null,
): void {
  // `extract()` is `unknown` on the base ApolloCache but a flat `TypeName:id`
  // map. Only the whole store finds every `SavedRecipe` carrying this folder,
  // whichever query cached it; this runs on a rename or delete.
  const snapshot = cache.extract();
  if (!isRecord(snapshot)) return;

  for (const [cacheId, entity] of Object.entries(snapshot)) {
    if (!cacheId.startsWith('SavedRecipe:')) continue;
    if ((isRecord(entity) ? entity.folder : undefined) !== from) continue;
    cache.modify({ id: cacheId, fields: { folder: () => to } });
  }
}

/**
 * A folder's recipes move to `moveTo`, which takes its place in the list, or
 * become unfoldered and it leaves the list.
 */
export function moveSavedFolder(
  cache: ApolloCache,
  folder: string,
  moveTo: string | null,
): void {
  const folders = readFolders(cache);
  if (folders) {
    writeFolders(
      cache,
      moveTo
        ? folders.map(name => (name === folder ? moveTo : name))
        : folders.filter(name => name !== folder),
    );
  }
  rewriteSavedRecipeFolders(cache, folder, moveTo);
}
