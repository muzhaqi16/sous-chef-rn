import type { ApolloCache } from '@apollo/client';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  LocalRefs_BrandFragmentDoc,
  LocalRefs_UnitFragmentDoc,
  type LocalRefs_BrandFragment,
  type LocalRefs_UnitFragment,
} from './localRefs.generated';

/**
 * What a pending edit shows for a nested record: complete for every row that
 * reads it, or a row with a hole reads as missing. The values live in the
 * write's layer, so the answer replaces them.
 */

/** A brand by id, or one the server will find or create from a typed name. */
export function localBrand(
  cache: ApolloCache,
  id: string | null | undefined,
  name: string,
): LocalRefs_BrandFragment {
  const brandId = id ?? generateEntityId();
  const held = cache.readFragment({
    id: cache.identify({ __typename: 'Brand', id: brandId }),
    fragment: LocalRefs_BrandFragmentDoc,
    fragmentName: 'localRefs_brand',
    optimistic: true,
  });
  return {
    __typename: 'Brand',
    id: brandId,
    name,
    version: held?.version ?? 0,
  };
}

/** A picked unit: as held, else what the field shows standing in until the answer. */
export function localUnit(
  cache: ApolloCache,
  id: string,
  label: string,
): LocalRefs_UnitFragment {
  const held = cache.readFragment({
    id: cache.identify({ __typename: 'Unit', id }),
    fragment: LocalRefs_UnitFragmentDoc,
    fragmentName: 'localRefs_unit',
    optimistic: true,
  });
  return (
    held ?? {
      __typename: 'Unit',
      id,
      name: label,
      symbol: label,
      type: UnitType.Count,
      localizedSymbolForms: {
        __typename: 'PluralForms',
        one: label,
        other: label,
      },
    }
  );
}
