/**
 * The lists saved as templates, shaped for the create screen's "start from
 * template" picker. `templateName` is what the user typed when saving, falling
 * back to the list's own name where none was captured. Skip it on screens that
 * do not offer the option, so list settings fires no extra request.
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
