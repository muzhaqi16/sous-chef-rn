import { useMutation } from '@apollo/client/react';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import type { CreatedStore } from './useCreateStore';
import { CreateStoreFromPlaceDocument } from './useCreateStoreFromPlace.generated';

/**
 * Makes a store of a place a search listed. Online only: the server reads the
 * place from the search, so there is nothing to show or queue before it answers.
 */
export function useCreateStoreFromPlace() {
  const { t } = useTranslation();
  const [create] = useMutation(CreateStoreFromPlaceDocument);

  /** Null when refused: the place has left the search, or the search is down. */
  const createStoreFromPlace = async (
    placeId: string,
  ): Promise<CreatedStore | null> => {
    const settled = await settleMutation(
      () => create({ variables: { input: { placeId } } }),
      {
        document: CreateStoreFromPlaceDocument,
        fallback: t('errors.generic'),
        present: 'none',
      },
    );
    if (settled.status !== 'applied') return null;
    const answered = appliedPayload(settled.data)?.store;
    return answered ? { id: answered.id, name: answered.name } : null;
  };

  return { createStoreFromPlace };
}
