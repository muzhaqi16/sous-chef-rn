/**
 * Both are local-first. markAsTemplate is an absolute flag set keyed by the list
 * id. createFromTemplate copies the template on the device — one create plus one
 * batch add, every row under a client-minted id — rather than asking the server
 * to fan out.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { MarkAsTemplateDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { readCopyableList } from '#features/shoppingList/cache/copySource';
import { listFromTemplate } from '#features/shoppingList/utils/listFromTemplate';
import { useCopyShoppingList } from './useCopyShoppingList';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
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
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'ShoppingList', id },
      fields: { isTemplate: true, templateName },
      variables: { input: { id, templateName } },
      mutate: markMutation,
      settle: {
        document: MarkAsTemplateDocument,
        fallback: t('shoppingListScreens.failedToSaveTemplate'),
      },
    });
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
