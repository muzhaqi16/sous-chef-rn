import type { ApolloCache } from '@apollo/client';
import { StorageType } from '#graphql/generated/schemaTypes';
import { generateEntityId } from '#utils/generateEntityId';
import {
  LocalStorageLocation_StorageLocationFragmentDoc,
  type LocalStorageLocation_StorageLocationFragment,
} from './localStorageLocation.generated';

// What a pending edit shows for a nested record: complete for every row that
// reads it, or a row with a hole reads as missing. The values live in the
// write's layer, so the answer replaces them.

/** A picked location as held, else a typed name the server will find or create. */
export function localStorageLocation(
  cache: ApolloCache,
  picked: { id: string; name: string; type: StorageType } | null | undefined,
  name: string,
): LocalStorageLocation_StorageLocationFragment {
  const id = picked?.id ?? generateEntityId();
  const held = cache.readFragment({
    id: cache.identify({ __typename: 'StorageLocation', id }),
    fragment: LocalStorageLocation_StorageLocationFragmentDoc,
    fragmentName: 'localStorageLocation_storageLocation',
    optimistic: true,
  });
  return {
    __typename: 'StorageLocation',
    id,
    name: picked?.name ?? name,
    type: picked?.type ?? StorageType.Custom,
    version: held?.version ?? 0,
  };
}
