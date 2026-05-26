/**
 * useConvertExpiredToWaste - Mutation hook for discarding expired pantry items
 *
 * Converts an expired pantry item to waste in one step:
 * - Sets condition to SPOILED
 * - Creates a WASTE usage record with wasteReason=EXPIRED
 * - Sets quantity to 0
 */

import { useMutation } from '@apollo/client/react';
import { ConvertExpiredToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { unwrapPayload } from '#/utils/compilerSafeWrappers';

export function useConvertExpiredToWaste() {
  const [convertMutation, { loading }] = useMutation(
    ConvertExpiredToWasteDocument,
  );

  const convertExpiredToWaste = async (pantryItemId: string) => {
    const { data } = await convertMutation({
      variables: { input: { pantryItemId } },
    });

    return unwrapPayload(
      data?.convertExpiredToWaste,
      'ConvertExpiredToWastePayload',
      'Failed to discard expired item',
    );
  };

  return { convertExpiredToWaste, loading };
}
