import type { ApolloCache } from '@apollo/client';
import { generateEntityId } from '#utils/generateEntityId';
import {
  LocalBrand_BrandFragmentDoc,
  type LocalBrand_BrandFragment,
} from './localBrand.generated';

// What a pending edit shows for a nested record: complete for every row that
// reads it, or a row with a hole reads as missing. The values live in the
// write's layer, so the answer replaces them.

/** A brand by id, or one the server will find or create from a typed name. */
export function localBrand(
  cache: ApolloCache,
  id: string | null | undefined,
  name: string,
): LocalBrand_BrandFragment {
  const brandId = id ?? generateEntityId();
  const held = cache.readFragment({
    id: cache.identify({ __typename: 'Brand', id: brandId }),
    fragment: LocalBrand_BrandFragmentDoc,
    fragmentName: 'localBrand_brand',
    optimistic: true,
  });
  return {
    __typename: 'Brand',
    id: brandId,
    name,
    version: held?.version ?? 0,
  };
}
