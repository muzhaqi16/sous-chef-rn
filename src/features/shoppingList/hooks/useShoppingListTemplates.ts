/**
 * useShoppingListTemplates — the lists the user saved as templates, shaped for
 * a picker.
 *
 * Backs the "start from template" option on the create screen. `templateName`
 * is what the user typed when saving the template; it falls back to the list's
 * own name for templates saved before a name was captured.
 *
 * Skipped by default on screens that don't need it, so opening an existing
 * list's settings doesn't fire an extra request.
 */

import { useQuery } from '@apollo/client/react';
import { GetShoppingListTemplatesDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

export interface ShoppingListTemplateOption {
  id: string;
  /** `templateName` when set, else the list's name. */
  displayName: string;
  totalItems: number;
}

export function useShoppingListTemplates(options: { skip?: boolean } = {}) {
  const { data, loading, error } = useQuery(GetShoppingListTemplatesDocument, {
    variables: { first: 50 },
    skip: options.skip,
  });

  useApolloErrorLogger('GetShoppingListTemplates', error);

  const templates: ShoppingListTemplateOption[] = extractNodes(
    data?.shoppingLists,
  ).map(node => ({
    id: node.id,
    displayName: node.templateName || node.name,
    totalItems: node.totalItems,
  }));

  return { templates, loading, error };
}
