import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  DeleteRecipeFolderDocument,
  SavedRecipeFoldersDocument,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { toastService } from '#/services/toastService';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { isRecord } from '#/utils/isRecord';

/**
 * Read / write the folder list. Module-level so each caller's try body stays a
 * single plain call — a value block inside a try bails the whole hook out of
 * the React Compiler.
 */
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
 * Moves every cached `SavedRecipe` from `from` to `to`, returning the changed
 * ids for a refusal to restore. The screen filters on each recipe's `folder`,
 * so rewriting only the folder LIST empties the renamed folder.
 */
function rewriteSavedRecipeFolders(
  cache: ApolloCache,
  from: string,
  to: string | null,
): string[] {
  // `extract()` is `unknown` on the base ApolloCache but a flat `TypeName:id`
  // map. Only the whole store finds every `SavedRecipe` carrying this folder,
  // whichever query cached it; this runs on a rename or delete.
  const snapshot = cache.extract();
  const changed: string[] = [];
  if (!isRecord(snapshot)) return changed;

  for (const [cacheId, entity] of Object.entries(snapshot)) {
    if (!cacheId.startsWith('SavedRecipe:')) continue;
    if ((isRecord(entity) ? entity.folder : undefined) !== from) continue;

    changed.push(cacheId);
    cache.modify({ id: cacheId, fields: { folder: () => to } });
  }

  return changed;
}

/** Put back what {@link rewriteSavedRecipeFolders} moved. */
function restoreSavedRecipeFolders(
  cache: ApolloCache,
  cacheIds: string[],
  folder: string | null,
): void {
  for (const cacheId of cacheIds) {
    cache.modify({ id: cacheId, fields: { folder: () => folder } });
  }
}

/**
 * Rename and delete both go through `deleteRecipeFolder`: without `moveTo` its
 * recipes become unfoldered, with it they move to the new folder.
 */
export function useFolderActions() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [loading, setLoading] = useState(false);

  const [deleteRecipeFolderMutation] = useMutation(DeleteRecipeFolderDocument, {
    context: { localFirst: true },
  });

  /**
   * Rename a folder by moving all recipes to a new folder name
   * @param oldName - Current folder name
   * @param newName - New folder name
   */
  const renameFolder = async (
    oldName: string,
    newName: string,
  ): Promise<boolean> => {
    if (!oldName || !newName || oldName === newName) return false;

    setLoading(true);

    // Rename the folder in the cache BEFORE firing so it survives a queued
    // (offline / API-down) call; a refusal restores the snapshot. Replaying is
    // safe: the old folder is already gone, which the server converges.
    const previousFolders = readFolders(client.cache);
    if (previousFolders) {
      writeFolders(
        client.cache,
        previousFolders.map(f => (f === oldName ? newName : f)),
      );
    }
    const movedRecipes = rewriteSavedRecipeFolders(
      client.cache,
      oldName,
      newName,
    );

    const settled = await settleMutation(
      () =>
        deleteRecipeFolderMutation({
          variables: { input: { folder: oldName, moveTo: newName } },
        }),
      {
        document: DeleteRecipeFolderDocument,
        fallback: t('recipes.renameFolderFailedRetry'),
        onFailed: () => {
          if (previousFolders) writeFolders(client.cache, previousFolders);
          restoreSavedRecipeFolders(client.cache, movedRecipes, oldName);
        },
        present: 'toast',
      },
    );

    setLoading(false);

    if (settled.failure) return false;

    toastService.success(t('recipes.folderRenamed', { oldName, newName }));
    return true;
  };

  /**
   * Delete a folder - all recipes become unfoldered
   * @param folderName - Folder to delete
   */
  const deleteFolder = async (folderName: string): Promise<boolean> => {
    if (!folderName) return false;

    setLoading(true);

    const previousFolders = readFolders(client.cache);
    if (previousFolders) {
      writeFolders(
        client.cache,
        previousFolders.filter(f => f !== folderName),
      );
    }
    // Deleting a folder unfolders its recipes — same field, same defect.
    const unfoldered = rewriteSavedRecipeFolders(
      client.cache,
      folderName,
      null,
    );

    const settled = await settleMutation(
      () =>
        deleteRecipeFolderMutation({
          variables: { input: { folder: folderName } },
        }),
      {
        document: DeleteRecipeFolderDocument,
        fallback: t('recipes.deleteFolderFailed'),
        onFailed: () => {
          if (previousFolders) writeFolders(client.cache, previousFolders);
          restoreSavedRecipeFolders(client.cache, unfoldered, folderName);
        },
        present: 'toast',
      },
    );

    setLoading(false);

    if (settled.failure) return false;

    toastService.success(t('recipes.folderDeleted', { folderName }));
    return true;
  };

  return {
    loading,
    renameFolder,
    deleteFolder,
  };
}
