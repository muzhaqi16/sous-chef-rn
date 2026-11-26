import type { OperationVariables } from '@apollo/client';
import { LOCAL_WRITES } from '#apollo/pendingWrites/localWriteRegistry';
import type { LocalWriteBinding } from '#apollo/pendingWrites/types';
import type { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { addItemToShoppingListWrite } from '#features/shoppingList/offline/localWrites';
import {
  authoredMutations,
  localFirstOperationNames,
} from '#/test-utils/queueableOperations';

/** Sent local-first with no local write of their own, each with its reason. */

const NO_LOCAL_WRITE: Record<string, string> = {
  MarkExpirationAction:
    'writes the notification store, not the cache: its answer states neither the row nor the badge',
  MovePurchasedItemsToPantry:
    'shows nothing until answered: the server picks the lines, and the pantry reads the rows',
};

const localFirst = () => {
  const authored = authoredMutations();
  return [...localFirstOperationNames()].filter(name => authored.has(name));
};

describe('local-first operations', () => {
  it('each has a local write, or a stated reason for having none', () => {
    const uncovered = localFirst()
      .filter(name => !LOCAL_WRITES[name] && !NO_LOCAL_WRITE[name])
      .sort();

    expect(uncovered).toEqual([]);
  });

  it('keeps the reasons honest', () => {
    const operations = new Set(localFirst());
    const stale = Object.keys(NO_LOCAL_WRITE).filter(
      name => !operations.has(name) || LOCAL_WRITES[name],
    );

    expect(stale).toEqual([]);
  });
});

/** The inputs a binding's `send` takes, read from the send itself. */
type SendInputsOf<B> = B extends LocalWriteBinding<
  infer TData,
  infer TVariables extends OperationVariables,
  infer TInputs
>
  ? Parameters<
      ReturnType<typeof useLocalWrite<TData, TVariables, TInputs>>['send']
    >[1]
  : never;

type AddRowsSendInputs = SendInputsOf<typeof addItemToShoppingListWrite>;

// Each fails typecheck, not this test, the day the send stops checking inputs.
const refusesAMistypedInput: {
  listId: number;
  rows: [];
  now: string;
} extends AddRowsSendInputs
  ? false
  : true = true;
const refusesAMissingInput: undefined extends AddRowsSendInputs ? false : true =
  true;
const takesTheWritesInputs: {
  listId: string;
  rows: [];
  now: string;
} extends AddRowsSendInputs
  ? true
  : false = true;

describe('a local write is sent through its binding', () => {
  it('checks the inputs against the bound write', () => {
    expect([
      refusesAMistypedInput,
      refusesAMissingInput,
      takesTheWritesInputs,
    ]).toEqual([true, true, true]);
  });
});
