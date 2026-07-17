/**
 * useShoppingListTemplate — save a list as a reusable template, or spin up a
 * new list from one.
 *
 * markAsTemplate is local-first: flagging a list as a template is an absolute
 * set keyed by the list id, so we write the flags to the cache before firing and
 * a queued replay re-applies them idempotently. A rejection restores the
 * snapshot and alerts.
 *
 * createFromTemplate is ONLINE-ONLY: it creates a brand-new list whose id the
 * server mints (no client id to key idempotency on), so a queued replay would
 * spawn duplicates. It adds the created list to the overview connection (same
 * updater createShoppingList uses) and returns its id for navigation.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
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
import { executeMutation } from '#/utils/compilerSafeWrappers';

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

    const result = await executeMutation(
      () =>
        markMutation({
          variables: { input: { id, templateName, saveItems } },
          context: { localFirst: true },
        }),
      'Mark As Template error:',
    );

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(
        result,
        'markAsTemplate',
        'MarkAsTemplatePayload',
        t('shoppingListScreens.failedToSaveTemplate'),
      )
    ) {
      revert();
      return false;
    }
    return true;
  };

  // Returns the created list's id (for navigation) or null on failure.
  const createFromTemplate = async (
    templateId: string,
    name?: string,
  ): Promise<string | null> => {
    const result = await executeMutation(
      () =>
        createMutation({
          variables: { input: { templateId, ...(name && { name }) } },
        }),
      'Create From Template error:',
    );

    if (!result) return null;
    if (
      alertIfRejected(
        result,
        'createFromTemplate',
        'CreateFromTemplatePayload',
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
