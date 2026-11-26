/**
 * Both are local-first. markAsTemplate is an absolute flag set keyed by the list
 * id. createFromTemplate copies the template on the device — one create plus one
 * batch add, every row under a client-minted id — rather than asking the server
 * to fan out.
 */

import { useApolloClient } from '@apollo/client/react';
import { useTranslation } from '#i18n';
import { readCopyableList } from '#features/shoppingList/cache/copySource';
import { listFromTemplate } from '#features/shoppingList/utils/listFromTemplate';
import { useCopyShoppingList } from './useCopyShoppingList';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { toastService } from '#services/toastService';
import { firstNonBlank } from '#utils/firstNonBlank';
import { markAsTemplateWrite } from '#features/shoppingList/offline/localWrites';

export function useShoppingListTemplate() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const mark = useLocalWrite(markAsTemplateWrite, {
    fallback: t('shoppingListScreens.failedToSaveTemplate'),
  });
  const { copyList, copying: creating } = useCopyShoppingList(
    t('shoppingListScreens.failedToCreateFromTemplate'),
  );

  const markAsTemplate = async (
    id: string,
    templateName: string,
  ): Promise<boolean> => {
    const settled = await mark.send(
      { input: { id, templateName } },
      {
        entity: { __typename: 'ShoppingList', id },
        fields: { isTemplate: true, templateName },
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

  return {
    markAsTemplate,
    createFromTemplate,
    marking: mark.sending,
    creating,
  };
}
