import { GraphQLError } from 'graphql';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { drained } from '#/test-utils/drainTimers';
import { ErrorCode } from '#graphql/generated/schemaTypes';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useAddShoppingRows, type AddedBatch } from '../useAddShoppingRows';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const items = [{ id: 'sli-1', item: { inline: { name: 'Milk' } } }];

/** Adds the one line and records how each batch was reported. */
const addAnswered = async (answer: MockedResponse) => {
  const reported: AddedBatch<(typeof items)[number]>[] = [];
  const { result } = renderHookWithApollo(() => useAddShoppingRows(), {
    operationMocks: [answer],
  });
  await drained(() =>
    result.current
      .addRows(
        'list-1',
        items,
        () => null,
        'Not added',
        batch => reported.push(batch),
      )
      .catch(() => undefined),
  );
  return reported;
};

// One batch, as it ended: a surface counting refusals counts each once.
describe('useAddShoppingRows reports a batch once', () => {
  it('when the server refuses it as a payload member', async () => {
    const reported = await addAnswered(
      recordMock(AddItemToShoppingListDocument, {
        data: {
          addItemsToShoppingList: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
          },
        },
      }).mock,
    );

    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ failed: true, answer: null });
  });

  it('when the answer carries a top-level error', async () => {
    const reported = await addAnswered({
      request: { query: AddItemToShoppingListDocument, variables: () => true },
      result: {
        errors: [
          new GraphQLError('Refused', {
            extensions: { code: ErrorCode.Forbidden },
          }),
        ],
      },
    });

    expect(reported).toHaveLength(1);
    expect(reported[0]?.failed).toBe(true);
  });

  it('when the send fails', async () => {
    const reported = await addAnswered(
      recordMock(AddItemToShoppingListDocument, {
        error: new Error('Network request failed'),
      }).mock,
    );

    expect(reported).toHaveLength(1);
    expect(reported[0]?.failed).toBe(true);
  });

  it('when it lands', async () => {
    const reported = await addAnswered(
      recordMock(AddItemToShoppingListDocument, {
        data: {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
          },
        },
      }).mock,
    );

    expect(reported).toHaveLength(1);
    expect(reported[0]?.failed).toBe(false);
  });
});
