import { useCallback, useState } from 'react';
import {
  useDeleteRecipeFolderMutation,
  SavedRecipeFoldersDocument,
  SavedRecipeFoldersQuery,
} from '#generated';
import { toastService } from '#/services/toastService';

/**
 * Hook for folder management actions (rename, delete)
 * Uses the deleteRecipeFolder mutation which handles both operations:
 * - Delete: deleteRecipeFolder(folder) - recipes become unfoldered
 * - Rename: deleteRecipeFolder(folder, moveTo) - recipes move to new folder
 */
export function useFolderActions() {
  const [loading, setLoading] = useState(false);

  const [deleteRecipeFolderMutation] = useDeleteRecipeFolderMutation({
    onError: err => {
      console.error('Folder action error:', err);
    },
  });

  /**
   * Rename a folder by moving all recipes to a new folder name
   * @param oldName - Current folder name
   * @param newName - New folder name
   */
  const renameFolder = useCallback(
    async (oldName: string, newName: string): Promise<boolean> => {
      if (!oldName || !newName || oldName === newName) return false;

      setLoading(true);
      try {
        const result = await deleteRecipeFolderMutation({
          variables: { folder: oldName, moveTo: newName },
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
        });
        const count = result.data?.deleteRecipeFolder ?? 0;
        toastService.success(`Renamed "${oldName}" to "${newName}" (${count} recipes)`);
        return true;
      } catch (error) {
        console.error('Failed to rename folder:', error);
        toastService.error('Failed to rename folder. Please try again.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [deleteRecipeFolderMutation],
  );

  /**
   * Delete a folder - all recipes become unfoldered
   * @param folderName - Folder to delete
   */
  const deleteFolder = useCallback(
    async (folderName: string): Promise<boolean> => {
      if (!folderName) return false;

      setLoading(true);
      try {
        const result = await deleteRecipeFolderMutation({
          variables: { folder: folderName },
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
        });
        const count = result.data?.deleteRecipeFolder ?? 0;
        if (count > 0) {
          toastService.success(
            `Deleted "${folderName}". ${count} recipe${count > 1 ? 's' : ''} moved to No Folder.`,
          );
        } else {
          toastService.success(`Deleted "${folderName}"`);
        }
        return true;
      } catch (error) {
        console.error('Failed to delete folder:', error);
        toastService.error('Failed to delete folder. Please try again.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [deleteRecipeFolderMutation],
  );

  return {
    loading,
    renameFolder,
    deleteFolder,
  };
}
