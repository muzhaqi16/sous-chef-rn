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

/**
 * Read / write the folder list. Module-level so each caller's try body stays a
 * single plain call — a value block inside a try bails the whole hook out of
 * the React Compiler.
 */
function readFolders(cache: ApolloCache): string[] | undefined {
  return (
    cache.readQuery<SavedRecipeFoldersQuery>({
      query: SavedRecipeFoldersDocument,
    })?.savedRecipeFolders ?? undefined
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function writeFolders(cache: ApolloCache, folders: string[]): void {
  cache.writeQuery<SavedRecipeFoldersQuery>({
    query: SavedRecipeFoldersDocument,
    data: { __typename: 'Query', savedRecipeFolders: folders },
  });
}

/**
 * Moves every cached `SavedRecipe` from `from` to `to`, returning the ids it
 * changed so a refusal can restore them. The folder LIST and each recipe's own
 * `folder` are separate cache state and the screen filters on the second, so
 * rewriting only the list leaves the renamed folder rendering empty.
 */
function rewriteSavedRecipeFolders(
  cache: ApolloCache,
  from: string,
  to: string | null,
): string[] {
  // `extract()` is `unknown` on the base ApolloCache but is a flat map keyed by
  // `TypeName:id`. Serializing the whole store is the cost of the only correct
  // question — which `SavedRecipe` entities carry this folder, whichever query
  // cached them — and this runs on a rename or delete, not a render path.
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
 * Hook for folder management actions (rename, delete)
 * Uses the deleteRecipeFolder mutation which handles both operations:
 * - Delete: deleteRecipeFolder(folder) - recipes become unfoldered
 * - Rename: deleteRecipeFolder(folder, moveTo) - recipes move to new folder
 */
export function useFolderActions() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [loading, setLoading] = useState(false);

  const [deleteRecipeFolderMutation] = useMutation(DeleteRecipeFolderDocument);

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
          context: { localFirst: true },
        }),
      {
        document: DeleteRecipeFolderDocument,
        fallback: t('recipes.renameFolderFailedRetry'),
        onFailed: () => {
          if (previousFolders) writeFolders(client.cache, previousFolders);
          restoreSavedRecipeFolders(client.cache, movedRecipes, oldName);
        },
        // Folder outcomes are reported as toasts, success and failure alike.
        present: 'none',
      },
    );

    setLoading(false);

    if (settled.failure) {
      toastService.error(settled.failure.body);
      return false;
    }

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
          context: { localFirst: true },
        }),
      {
        document: DeleteRecipeFolderDocument,
        fallback: t('recipes.deleteFolderFailed'),
        onFailed: () => {
          if (previousFolders) writeFolders(client.cache, previousFolders);
          restoreSavedRecipeFolders(client.cache, unfoldered, folderName);
        },
        present: 'none',
      },
    );

    setLoading(false);

    if (settled.failure) {
      toastService.error(settled.failure.body);
      return false;
    }

    toastService.success(t('recipes.folderDeleted', { folderName }));
    return true;
  };

  return {
    loading,
    renameFolder,
    deleteFolder,
  };
}
