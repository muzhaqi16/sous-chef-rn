import type { ApolloCache } from '@apollo/client';
import { UnitType } from '#graphql/generated/schemaTypes';
import {
  LocalUnit_UnitFragmentDoc,
  type LocalUnit_UnitFragment,
} from './localUnit.generated';

// What a pending edit shows for a nested record: complete for every row that
// reads it, or a row with a hole reads as missing. The values live in the
// write's layer, so the answer replaces them.

/** A picked unit: as held, else what the field shows standing in until the answer. */
export function localUnit(
  cache: ApolloCache,
  id: string,
  label: string,
): LocalUnit_UnitFragment {
  const held = cache.readFragment({
    id: cache.identify({ __typename: 'Unit', id }),
    fragment: LocalUnit_UnitFragmentDoc,
    fragmentName: 'localUnit_unit',
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
