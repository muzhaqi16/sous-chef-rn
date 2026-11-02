import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateStorageLocationDocument } from '#features/catalog/graphql/storageLocation.generated';
import type { CreateLocationInputs } from '#features/catalog/offline/localWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import type { CreateStorageLocationInput } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';

type CreateLocationInput = Omit<CreateStorageLocationInput, 'homeId'>;

/**
 * Creates a storage location local-first under a client-minted id, listed in the
 * `storageLocations` query and `Pantry.storageLocationsConnection` until the
 * server answers, so a queued create replays under the same primary key.
 */
export function useCreateStorageLocation(
  homeId: string | undefined,
  pantryId: string | undefined,
) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [createMutation, { loading: creating }] = useMutation(
    CreateStorageLocationDocument,
    { context: { localFirst: true } },
  );

  const createLocation = async (input: CreateLocationInput) => {
    if (!homeId) {
      alertService.alert(t('labels.error'), t('errors.parentContextRequired'));
      return false;
    }

    const id = generateEntityId();
    const inputs: CreateLocationInputs = {
      location: { ...input, id },
      homeId,
      pantryId,
    };
    const settled = await pendingWritesOf(client.cache).send(
      CreateStorageLocationDocument,
      { input: { ...input, homeId, id } },
      write =>
        settleMutation(() => createMutation(write), {
          document: CreateStorageLocationDocument,
          fallback: t('errors.createStorageLocationFailed'),
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  return { createLocation, creating };
}
