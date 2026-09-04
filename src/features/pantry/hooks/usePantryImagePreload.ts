import { useEffect } from 'react';
import { useApolloClient } from '@apollo/client/react';
import {
  PantryContent_PantryItemFragmentDoc,
  type PantryContent_PantryItemFragment,
} from '#features/pantry/components/PantryContent.generated';
import { IMAGE_PRELOAD_COUNT } from '#features/pantry/components/pantryDisplay/constants';
import type { PantryListNode } from '#features/pantry/components/pantryDisplay/renderItem';
import { preloadImages } from '#components/atoms/CachedImage';
import { resolveImageUrl } from '#utils/imageUtils';

/**
 * Warm the image cache for the rows about to appear. Fragment refs carry no
 * field data at runtime (masked), so the URLs come from a one-shot
 * `readFragment` inside an idle callback rather than from the node.
 */
export function usePantryImagePreload(nodes: readonly PantryListNode[]) {
  const client = useApolloClient();

  useEffect(() => {
    if (nodes.length === 0) return;

    const handle = requestIdleCallback(() => {
      const urls: string[] = [];
      for (const node of nodes.slice(0, IMAGE_PRELOAD_COUNT)) {
        const item =
          client.cache.readFragment<PantryContent_PantryItemFragment>({
            fragment: PantryContent_PantryItemFragmentDoc,
            fragmentName: 'PantryContent_pantryItem',
            from: node,
          });
        if (!item) continue;
        const url = resolveImageUrl(item);
        if (url) urls.push(url);
      }
      if (urls.length > 0) {
        preloadImages(urls);
      }
    });
    return () => cancelIdleCallback(handle);
  }, [nodes, client]);
}
