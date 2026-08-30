/**
 * markAsTemplate is local-first: the flags are an absolute set keyed by the list
 * id, written to the cache before firing and idempotent on a queued replay.
 * createFromTemplate is ONLINE-ONLY — the server mints the new list's id, so there
 * is no client key to make a replay idempotent and a queued one would duplicate.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  MarkAsTemplateDocument,
  CreateFromTemplateDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseShoppingListTemplate_ListFragmentDoc,
  type UseShoppingListTemplate_ListFragment,
} from './useShoppingListTemplate.generated';
import { addShoppingListToQueryCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
import { errorService } from '#/services/errorService';

export function useShoppingListTemplate() {
  const { t } = useTranslation();
  const client = useApolloClient();
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
    const revert =
      applyOptimisticFragmentPatch<UseShoppingListTemplate_ListFragment>(
        client.cache,
        { typename: 'ShoppingList', id },
        {
          fragment: UseShoppingListTemplate_ListFragmentDoc,
          fragmentName: 'useShoppingListTemplate_list',
        },
        { isTemplate: true, templateName },
        'Mark As Template',
      );

    let result;
    try {
      result = await markMutation({
        variables: { input: { id, templateName, saveItems } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Mark As Template error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToSaveTemplate'))
    ) {
      revert();
      return false;
    }
    return true;
  };

  const createFromTemplate = async (
    templateId: string,
    name?: string,
  ): Promise<string | null> => {
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

  return { markAsTemplate, createFromTemplate, marking, creating };
}
