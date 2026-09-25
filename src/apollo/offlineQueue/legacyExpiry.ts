import type { OperationVariables } from '@apollo/client';
import { Kind, type DocumentNode, type TypeNode } from 'graphql';
import { isRecord } from '#/utils/isRecord';
import { toDateKey } from '#/utils/dateUtils';

/** The inputs whose `expiresAt` became `expiresOn`; an invite's is still an instant. */
const DATE_ONLY_EXPIRY_INPUTS = new Set([
  'CreatePantryItemInput',
  'UpdatePantryItemInput',
  'SyncPantryItemInput',
  'RestockPantryItemInput',
  'MoveShoppingItemToPantryInput',
]);

const namedType = (type: TypeNode): string =>
  type.kind === Kind.NAMED_TYPE ? type.name.value : namedType(type.type);

/** The named type of an operation's `$input`, e.g. `CreatePantryItemInput`. */
export const inputTypeOf = (document: DocumentNode): string | null => {
  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
    const input = definition.variableDefinitions?.find(
      v => v.variable.name.value === 'input',
    );
    if (input) return namedType(input.type);
  }
  return null;
};

/**
 * A write queued by a build that sent `expiresAt` as the picked day's local
 * midnight through `toISOString()`. The API stores that as its UTC date, a day
 * early east of UTC; read back on this device, the instant is the day the user
 * picked, so it replays as `expiresOn`.
 */
export const withExpiresOn = (
  document: DocumentNode,
  variables: OperationVariables,
): OperationVariables => {
  const input: unknown = variables.input;
  if (
    !isRecord(input) ||
    !('expiresAt' in input) ||
    'expiresOn' in input ||
    !DATE_ONLY_EXPIRY_INPUTS.has(inputTypeOf(document) ?? '')
  ) {
    return variables;
  }
  const { expiresAt, ...rest } = input;
  if (expiresAt === null) {
    return { ...variables, input: { ...rest, expiresOn: null } };
  }
  const instant = typeof expiresAt === 'string' ? new Date(expiresAt) : null;
  if (!instant || Number.isNaN(instant.getTime())) return variables;
  return { ...variables, input: { ...rest, expiresOn: toDateKey(instant) } };
};
