import { operationNameOf } from '#/apollo/utils/documentOperation';
import { isOwnKey } from '#/utils/isOwnKey';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';

type FoldedOperation = 'BarcodeCreatePantryItem' | 'BarcodeRestockPantryItem';

/**
 * A feature's own copy of a mutation that a later build folded into the
 * canonical one, by the name it replays under now. The registries key on the
 * name and an entry replays its own stored document, so only the name moves.
 */
const FOLDED_OPERATIONS: Record<FoldedOperation, string> = {
  BarcodeCreatePantryItem: operationNameOf(CreatePantryItemDocument),
  BarcodeRestockPantryItem: operationNameOf(RestockPantryItemDocument),
};

/** The name a write queued by an earlier build is replayed and withdrawn under. */
export const currentOperationName = (operationName: string): string =>
  isOwnKey(FOLDED_OPERATIONS, operationName)
    ? FOLDED_OPERATIONS[operationName]
    : operationName;
