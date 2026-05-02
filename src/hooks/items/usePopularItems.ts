import { useQuery } from '@apollo/client/react';
import { GetPopularItemsDocument } from '../../graphql/operations/item/item.generated';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';

export interface PopularItem {
  id: string;
  name: string;
  imageUrl?: string | null;
  displayUnit?: {
    id: string;
    name: string;
    symbol: string;
  } | null;
  brand?: string | null;
  category?: {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
  } | null;
}

/**
 * Hook to fetch globally popular items for auto-suggest
 * Shows popular items when user hasn't typed anything or when search results are few
 */
export function usePopularItems(limit = 10) {
  const isOffline = useIsEffectivelyOffline();

  const { data, loading, error } = useQuery(GetPopularItemsDocument, {
    variables: { first: limit },
    fetchPolicy: 'cache-first',
    skip: isOffline,
  });

  const popularItems = (() => {
    if (!data?.items?.edges) return [];

    return data.items.edges.map(edge => {
      const item = edge.node;
      // Get first brand name if available
      const firstBrand = item.brands?.[0]?.brand;
      // Get primary category or first category
      const primaryCategory =
        item.categories?.find(c => c.isPrimary)?.category ||
        item.categories?.[0]?.category;

      return {
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        displayUnit: item.displayUnit
          ? {
              id: item.displayUnit.id,
              name: item.displayUnit.name,
              symbol: item.displayUnit.symbol,
            }
          : null,
        brand: firstBrand?.name ?? null,
        category: primaryCategory
          ? {
              id: primaryCategory.id,
              name: primaryCategory.name,
            }
          : null,
      };
    });
  })();

  return {
    popularItems: isOffline ? [] : popularItems,
    loading,
    error,
    totalCount: isOffline ? 0 : data?.items?.totalCount ?? 0,
    isOffline,
  };
}
