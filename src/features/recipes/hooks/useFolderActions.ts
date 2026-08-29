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
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';

/** Read / write the folder list — the mutation's payload carries no folder list,
 *  so the cached one is reconciled from the accepted result. */
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
 * Hook for folder management actions (rename, delete). Online only — both go
 * through the deleteRecipeFolder mutation, which handles both operations:
 * - Delete: deleteRecipeFolder(folder) - recipes become unfoldered
 * - Rename: deleteRecipeFolder(folder, moveTo) - recipes move to new folder
 */
export function useFolderActions() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [loading, setLoading] = useState(false);
  const isApiUnavailable = useIsApiUnavailable();

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

    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    setLoading(true);

    let result;
    try {
      result = await deleteRecipeFolderMutation({
        variables: { input: { folder: oldName, moveTo: newName } },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'renameFolder' });
    }

    setLoading(false);

    if (classifyCreateResult(result) === 'rejected') {
      const rejected = result?.data?.deleteRecipeFolder;
      const reason =
        rejected && 'message' in rejected ? rejected.message : null;
      toastService.error(reason ?? t('recipes.renameFolderFailedRetry'));
      return false;
    }

    const folders = readFolders(client.cache);
    if (folders) {
      writeFolders(
        client.cache,
        folders.map(f => (f === oldName ? newName : f)),
      );
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

    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    setLoading(true);

    let result;
    try {
      result = await deleteRecipeFolderMutation({
        variables: { input: { folder: folderName } },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'deleteFolder' });
    }

    setLoading(false);

    if (classifyCreateResult(result) === 'rejected') {
      const rejected = result?.data?.deleteRecipeFolder;
      const reason =
        rejected && 'message' in rejected ? rejected.message : null;
      toastService.error(reason ?? t('recipes.deleteFolderFailed'));
      return false;
    }

    const folders = readFolders(client.cache);
    if (folders) {
      writeFolders(
        client.cache,
        folders.filter(f => f !== folderName),
      );
    }

    toastService.success(t('recipes.folderDeleted', { folderName }));
    return true;
  };

  return {
    loading,
    renameFolder,
    deleteFolder,
    isApiUnavailable,
  };
}
