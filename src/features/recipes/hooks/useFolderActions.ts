import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { DeleteRecipeFolderDocument } from '#features/recipes/graphql/recipe.generated';
import type { MoveFolderInputs } from '#features/recipes/offline/localWrites';
import { useLocalWrite } from '#/apollo/pendingWrites/useLocalWrite';
import { toastService } from '#/services/toastService';

/**
 * Rename and delete both go through `deleteRecipeFolder`: without `moveTo` its
 * recipes become unfoldered, with it they move to the new folder.
 */
export function useFolderActions() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const moveFolder = useLocalWrite(DeleteRecipeFolderDocument, {
    fallback: t('recipes.deleteFolderFailed'),
    present: 'toast',
  });

  const sendMove = (inputs: MoveFolderInputs, fallback: string) =>
    moveFolder.send(
      {
        input: inputs.moveTo
          ? { folder: inputs.folder, moveTo: inputs.moveTo }
          : { folder: inputs.folder },
      },
      inputs,
      { settle: { fallback } },
    );

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

    // Replaying is safe: the old folder is already gone, which the server
    // converges.
    const settled = await sendMove(
      { folder: oldName, moveTo: newName },
      t('recipes.renameFolderFailedRetry'),
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

    const settled = await sendMove(
      { folder: folderName, moveTo: null },
      t('recipes.deleteFolderFailed'),
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
