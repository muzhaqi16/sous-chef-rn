/**
 * useShoppingListTemplate — save a list as a reusable template, or spin up a
 * new list from one.
 *
 * Both are ONLINE-ONLY. markAsTemplate is list configuration and the mutation
 * returns the flagged list, so Apollo normalizes `isTemplate`/`templateName`
 * off the real result. createFromTemplate creates a brand-new list whose id the
 * server mints (no client id to key idempotency on), so a queued replay would
 * spawn duplicates; it adds the created list to the overview connection (same
 * updater createShoppingList uses) and returns its id for navigation.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  MarkAsTemplateDocument,
  CreateFromTemplateDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { addShoppingListToQueryCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';

export function useShoppingListTemplate() {
  const { t } = useTranslation();
  const isApiUnavailable = useIsApiUnavailable();
  const [markMutation, { loading: marking }] = useMutation(
    MarkAsTemplateDocument,
  );
  const [createMutation, { loading: creating }] = useMutation(
    CreateFromTemplateDocument,
    {
      update(cache, { data }) {
        if (
          data?.createFromTemplate?.__typename === 'CreateFromTemplatePayload'
        ) {
          addShoppingListToQueryCache(
            cache,
            data.createFromTemplate.shoppingList,
          );
        }
      },
    },
  );

  const markAsTemplate = async (
    id: string,
    templateName: string,
    saveItems = true,
  ): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await markMutation({
        variables: { input: { id, templateName, saveItems } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Mark As Template error:',
      });
    }

    if (!result) return false;
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToSaveTemplate'))
    ) {
      return false;
    }
    return true;
  };

  // Returns the created list's id (for navigation) or null on failure.
  const createFromTemplate = async (
    templateId: string,
    name?: string,
  ): Promise<string | null> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }

    let result;
    const createMutationOptions = {
      variables: { input: { templateId, ...(name && { name }) } },
    };
    try {
      result = await createMutation(createMutationOptions);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Create From Template error:',
      });
    }

    if (!result) return null;
    if (
      alertIfRejected(
        result,
        t('shoppingListScreens.failedToCreateFromTemplate'),
      )
    ) {
      return null;
    }
    const payload = result.data?.createFromTemplate;
    return payload?.__typename === 'CreateFromTemplatePayload'
      ? payload.shoppingList.id
      : null;
  };

  return {
    markAsTemplate,
    createFromTemplate,
    marking,
    creating,
    isApiUnavailable,
  };
}
