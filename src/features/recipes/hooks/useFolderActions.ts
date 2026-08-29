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
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';

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
 * Move every cached `SavedRecipe` out of `from` and into `to`.
 *
 * The folder LIST and the recipes' own `folder` field are two separate pieces
 * of cache state, and the Saved Recipes screen filters on the second
 * (`recipe.folder === selectedFolder`). Rewriting only the list renamed the
 * chip and left every recipe pointing at the old name, so the folder the user
 * had just renamed rendered empty under a success toast. `DeleteRecipeFolderPayload`
 * returns no recipe nodes, and this hook has no `refetchQueries`, so nothing
 * else repairs it — and under `localFirst` there is no response at all until
 * the queue replays.
 *
 * Returns the ids it changed so a refusal can put them back.
 */
function rewriteSavedRecipeFolders(
  cache: ApolloCache,
  from: string,
  to: string | null,
): string[] {
  // `extract()` is typed as `unknown` on the base ApolloCache; the normalized
  // store is a flat map keyed by `TypeName:id`, which is what the loop needs.
  const snapshot = cache.extract() as Record<
    string,
    { folder?: string | null } | undefined
  >;
  const changed: string[] = [];

  for (const cacheId of Object.keys(snapshot)) {
    if (!cacheId.startsWith('SavedRecipe:')) continue;
    if (snapshot[cacheId]?.folder !== from) continue;

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
    const movedRecipes = rewriteSavedRecipeFolders(
      client.cache,
      oldName,
      newName,
    );

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
      restoreSavedRecipeFolders(client.cache, movedRecipes, oldName);
      // The app's own words. `message` is the server's English by construction
      // — the client sends no `Accept-Language` and the token carries no locale
      // — so this displayed untranslated text to every es/it/sq user. The
      // mutation already selects `... on ValidationError { field }`, which is
      // the actionable half anyway.
      toastService.error(
        localizedRefusalMessage(
          result?.data?.deleteRecipeFolder,
          t('recipes.renameFolderFailedRetry'),
        ),
      );
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
      restoreSavedRecipeFolders(client.cache, unfoldered, folderName);
      toastService.error(
        localizedRefusalMessage(
          result?.data?.deleteRecipeFolder,
          t('recipes.deleteFolderFailed'),
        ),
      );
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
