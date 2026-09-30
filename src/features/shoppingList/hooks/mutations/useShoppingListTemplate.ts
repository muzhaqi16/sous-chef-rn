/**
 * Both are local-first. markAsTemplate is an absolute flag set keyed by the list
 * id. createFromTemplate copies the template on the device — one create plus one
 * batch add, every row under a client-minted id — rather than asking the server
 * to fan out.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { MarkAsTemplateDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseShoppingListTemplate_ListFragmentDoc,
  type UseShoppingListTemplate_ListFragment,
} from './useShoppingListTemplate.generated';
import { readCopyableList } from '#features/shoppingList/cache/copySource';
import { listFromTemplate } from '#features/shoppingList/utils/listFromTemplate';
import { useCopyShoppingList } from './useCopyShoppingList';
import { settleMutation } from '#/apollo/utils/settleMutation';
import {
  snapshotFields,
  writeEntityFields,
} from '#/apollo/utils/localFirstFields';
import { toastService } from '#/services/toastService';
import { firstNonBlank } from '#/utils/firstNonBlank';

export function useShoppingListTemplate() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [markMutation, { loading: marking }] = useMutation(
    MarkAsTemplateDocument,
    { context: { localFirst: true } },
  );
  const { copyList, copying: creating } = useCopyShoppingList(
    t('shoppingListScreens.failedToCreateFromTemplate'),
  );

  const markAsTemplate = async (
    id: string,
    templateName: string,
  ): Promise<boolean> => {
    const entity = { __typename: 'ShoppingList', id };
    const patch = { isTemplate: true, templateName };
    const held =
      client.cache.readFragment<UseShoppingListTemplate_ListFragment>({
        id: client.cache.identify(entity),
        fragment: UseShoppingListTemplate_ListFragmentDoc,
        fragmentName: 'useShoppingListTemplate_list',
        returnPartialData: true,
      });
    const previous = snapshotFields(held, patch);
    writeEntityFields(client.cache, entity, patch);
    const revert = () => writeEntityFields(client.cache, entity, previous);

    const settled = await settleMutation(
      () =>
        markMutation({
          variables: { input: { id, templateName } },
        }),
      {
        document: MarkAsTemplateDocument,
        fallback: t('shoppingListScreens.failedToSaveTemplate'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  /**
   * `homeId` overrides the template's own link; leaving it out keeps the
   * template's home, which the server's fan-out could not carry at all.
   */
  const createFromTemplate = async (
    templateId: string,
    name?: string,
    homeId?: string | null,
  ): Promise<string | null> => {
    const source = readCopyableList(client.cache, templateId);
    if (!source) {
      toastService.error(t('shoppingListScreens.copySourceNotLoaded'));
      return null;
    }

    const derived = listFromTemplate(source, {
      name:
        firstNonBlank(name)?.trim() ??
        t('labels.copyOfName', { name: source.name }),
    });

    const listId = await copyList(derived, { homeId });
    if (!listId) return null;
    if (derived.skipped.length > 0) {
      toastService.info(
        t('shoppingListScreens.copyLinesSkipped', {
          count: derived.skipped.length,
        }),
      );
    }
    return listId;
  };

  return { markAsTemplate, createFromTemplate, marking, creating };
}
