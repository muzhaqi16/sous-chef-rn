import { skipToken, useQuery } from '@apollo/client/react';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useToday } from '#hooks/app/useToday';
import { SoonestDatedItemDocument } from './useSoonestDatedItem.generated';

/**
 * The name of the pantry's dated stock that expires first; null with nothing
 * dated, or nothing read. A failed read leaves it null, which asks nothing.
 */
export function useSoonestDatedItem(
  pantryId: string | null | undefined,
  { skip = false }: { skip?: boolean } = {},
): string | null {
  const today = useToday();
  const { data, error } = useQuery(
    SoonestDatedItemDocument,
    pantryId && !skip
      ? { variables: { pantryId, today }, fetchPolicy: 'cache-and-network' }
      : skipToken,
  );
  useApolloErrorLogger(SoonestDatedItemDocument, error);
  const [edge] = data?.pantry?.itemsConnection.edges ?? [];
  return edge?.node.item.name ?? null;
}
