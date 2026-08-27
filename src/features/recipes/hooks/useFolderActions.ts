import { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  DeleteRecipeFolderDocument,
  SavedRecipeFoldersDocument,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { toastService } from '#/services/toastService';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';

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

function writeFolders(cache: ApolloCache, folders: string[]): void {
  cache.writeQuery<SavedRecipeFoldersQuery>({
    query: SavedRecipeFoldersDocument,
    data: { __typename: 'Query', savedRecipeFolders: folders },
  });
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

  const [deleteRecipeFolderMutation] = useMutation(DeleteRecipeFolderDocument, {
    onError: err => {
      errorService.reportError(err, { operation: 'folderAction' });
    },
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

    let result;
    try {
      result = await deleteRecipeFolderMutation({
        variables: { input: { folder: oldName, moveTo: newName } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'renameFolder' });
    }

    setLoading(false);

    if (classifyCreateResult(result) === 'rejected') {
      if (previousFolders) writeFolders(client.cache, previousFolders);
      const rejected = result?.data?.deleteRecipeFolder;
      const reason =
        rejected && 'message' in rejected ? rejected.message : null;
      toastService.error(reason ?? t('recipes.renameFolderFailedRetry'));
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

    let result;
    try {
      result = await deleteRecipeFolderMutation({
        variables: { input: { folder: folderName } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'deleteFolder' });
    }

    setLoading(false);

    if (classifyCreateResult(result) === 'rejected') {
      if (previousFolders) writeFolders(client.cache, previousFolders);
      const rejected = result?.data?.deleteRecipeFolder;
      const reason =
        rejected && 'message' in rejected ? rejected.message : null;
      toastService.error(reason ?? t('recipes.deleteFolderFailed'));
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
