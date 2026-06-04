import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import {
  DeleteRecipeFolderDocument,
  SavedRecipeFoldersDocument,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { toastService } from '#/services/toastService';

/**
 * Hook for folder management actions (rename, delete)
 * Uses the deleteRecipeFolder mutation which handles both operations:
 * - Delete: deleteRecipeFolder(folder) - recipes become unfoldered
 * - Rename: deleteRecipeFolder(folder, moveTo) - recipes move to new folder
 */
export function useFolderActions() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const [deleteRecipeFolderMutation] = useMutation(DeleteRecipeFolderDocument, {
    onError: err => {
      console.error('Folder action error:', err);
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

    const result = await executeMutation(
      () =>
        deleteRecipeFolderMutation({
          variables: { input: { folder: oldName, moveTo: newName } },
          update(cache) {
            const existing = cache.readQuery<SavedRecipeFoldersQuery>({
              query: SavedRecipeFoldersDocument,
            });
            if (existing?.savedRecipeFolders) {
              cache.writeQuery<SavedRecipeFoldersQuery>({
                query: SavedRecipeFoldersDocument,
                data: {
                  __typename: 'Query',
                  savedRecipeFolders: existing.savedRecipeFolders.map(f =>
                    f === oldName ? newName : f,
                  ),
                },
              });
            }
          },
        }),
      error => {
        console.error('Failed to rename folder:', error);
        toastService.error(t('recipes.renameFolderFailedRetry'));
      },
    );

    setLoading(false);

    if (!result) return false;

    const payload = result.data?.deleteRecipeFolder;
    if (payload?.__typename === 'DeleteRecipeFolderPayload') {
      toastService.success(t('recipes.folderRenamed', { oldName, newName }));
      return true;
    }
    const message = payload && 'message' in payload ? payload.message : null;
    toastService.error(message ?? t('recipes.renameFolderFailed'));
    return false;
  };

  /**
   * Delete a folder - all recipes become unfoldered
   * @param folderName - Folder to delete
   */
  const deleteFolder = async (folderName: string): Promise<boolean> => {
    if (!folderName) return false;

    setLoading(true);

    const result = await executeMutation(
      () =>
        deleteRecipeFolderMutation({
          variables: { input: { folder: folderName } },
          update(cache) {
            const existing = cache.readQuery<SavedRecipeFoldersQuery>({
              query: SavedRecipeFoldersDocument,
            });
            if (existing?.savedRecipeFolders) {
              cache.writeQuery<SavedRecipeFoldersQuery>({
                query: SavedRecipeFoldersDocument,
                data: {
                  __typename: 'Query',
                  savedRecipeFolders: existing.savedRecipeFolders.filter(
                    f => f !== folderName,
                  ),
                },
              });
            }
          },
        }),
      error => {
        console.error('Failed to delete folder:', error);
        toastService.error(t('recipes.deleteFolderFailedRetry'));
      },
    );

    setLoading(false);

    if (!result) return false;

    const payload = result.data?.deleteRecipeFolder;
    if (payload?.__typename === 'DeleteRecipeFolderPayload') {
      toastService.success(t('recipes.folderDeleted', { folderName }));
      return true;
    }
    const message = payload && 'message' in payload ? payload.message : null;
    toastService.error(message ?? t('recipes.deleteFolderFailed'));
    return false;
  };

  return {
    loading,
    renameFolder,
    deleteFolder,
  };
}
