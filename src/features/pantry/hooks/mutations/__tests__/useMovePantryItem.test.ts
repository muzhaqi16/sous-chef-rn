'use no memo';

import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { ChangePantryItemItemDocument } from '#features/pantry/hooks/mutations/useMovePantryItem.generated';
import { useMovePantryItem } from '#features/pantry/hooks/mutations/useMovePantryItem';
import { alertService } from '#/services/alertService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';

// The payload carries the whole stack, so the cache settles from it: these
// read the stack back.
const STACK_ITEM = gql`
  fragment MovePantryItemTest_pantryItem on PantryItem {
    id
    itemId
    item {
      id
    }
  }
`;

type Result = MockDataFor<
  typeof ChangePantryItemItemDocument
>['changePantryItemItem'];

const moved = (receiptCorrectionRecorded: boolean): Result => ({
  __typename: 'ChangePantryItemItemPayload',
  receiptCorrectionRecorded,
  pantryItem: {
    __typename: 'PantryItem',
    id: 'stack-1',
    itemId: 'produce-bananas',
    item: { __typename: 'Item', id: 'produce-bananas' },
  },
});

const STACK = { id: 'stack-1', version: 4 };

const render = (result: Result) => {
  const move = recordMock(ChangePantryItemItemDocument, {
    data: { changePantryItemItem: result },
  });
  const cache = seedCache([]);
  const hook = renderHookWithApollo(() => useMovePantryItem(), {
    cache,
    operationMocks: [move.mock],
  });
  return { ...hook, cache, fired: move.fired };
};

const moveTo = async (
  result: ReturnType<typeof render>['result'],
  onConflictRefresh = jest.fn(),
) => {
  let outcome;
  await act(async () => {
    outcome = await result.current.moveToItem(
      STACK,
      'produce-bananas',
      onConflictRefresh,
    );
  });
  return outcome;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMovePantryItem', () => {
  it('moves the stack, sending the version it was read at', async () => {
    const { result, cache, fired } = render(moved(false));

    const outcome = await moveTo(result);

    expect(outcome).toEqual({
      status: 'moved',
      receiptCorrectionRecorded: false,
    });
    expect(fired).toEqual([
      expect.objectContaining({
        input: {
          pantryItemId: 'stack-1',
          itemId: 'produce-bananas',
          version: 4,
        },
      }),
    ]);
    expect(
      cache.readFragment<{ itemId: string }>({
        id: 'PantryItem:stack-1',
        fragment: STACK_ITEM,
      })?.itemId,
    ).toBe('produce-bananas');
  });

  it('says when the next receipts will read the lines as the new item', async () => {
    const { result } = render(moved(true));

    expect(await moveTo(result)).toEqual({
      status: 'moved',
      receiptCorrectionRecorded: true,
    });
  });

  it('names the stack the pantry already holds, and reports nothing itself', async () => {
    const { result } = render({
      __typename: 'DuplicatePantryItemError',
      code: ErrorCode.Conflict,
      message: 'Already stocked',
      existingPantryItemIds: ['stack-9'],
    });

    expect(await moveTo(result)).toEqual({
      status: 'duplicate',
      existingPantryItemId: 'stack-9',
    });
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('offers a refresh when the stack changed since it was read', async () => {
    const { result } = render({
      __typename: 'ConflictError',
      code: ErrorCode.VersionConflict,
      message: 'Stale',
    });
    const onConflictRefresh = jest.fn();

    expect(await moveTo(result, onConflictRefresh)).toEqual({
      status: 'failed',
    });
    const [, , buttons] = jest.mocked(alertService.alert).mock.calls[0] ?? [];
    buttons?.find(button => button.text === 'Refresh')?.onPress?.();
    expect(onConflictRefresh).toHaveBeenCalled();
  });

  it('reports any other refusal and answers that nothing moved', async () => {
    const { result } = render({
      __typename: 'ForbiddenError',
      code: ErrorCode.Forbidden,
      message: 'Not allowed',
    });

    expect(await moveTo(result)).toEqual({ status: 'failed' });
    expect(alertService.alert).toHaveBeenCalledWith(
      "Couldn't move this entry",
      expect.any(String),
    );
  });
});
