import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { ErrorCode } from '#graphql/generated/schemaTypes';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useLocalWrite } from '../useLocalWrite';

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  name: 'Weekly',
};
const variables = { input: { id: 'list-1', version: 1, name: 'Party' } };
const fields = {
  entity: { __typename: 'ShoppingList', id: 'list-1' },
  fields: { name: 'Party' },
};

let log = operationLog();

const render = (answer: ReturnType<typeof recordMock>) => {
  const cache = seedCache([LIST]);
  const hook = renderHookWithApollo(
    () =>
      useLocalWrite(UpdateShoppingListDocument, {
        fallback: 'Could not rename the list',
        present: 'none',
      }),
    { cache, links: [log.link], operationMocks: [answer.mock] },
  );
  return { ...hook, cache };
};

const nameOf = (cache: ReturnType<typeof seedCache>) =>
  (cache.extract(true)['ShoppingList:list-1'] as { name?: string } | undefined)
    ?.name;

/** Sends, and hands back how the write settled once it has. */
async function settledBy<T>(send: () => Promise<T>): Promise<T | undefined> {
  let settled: T | undefined;
  await act(async () => {
    settled = await send();
  });
  return settled;
}

beforeEach(() => {
  log = operationLog();
});

describe('useLocalWrite', () => {
  it('settles applied with the answer, sending the variables it was given', async () => {
    const answer = recordMock(UpdateShoppingListDocument, {
      data: {
        updateShoppingList: {
          __typename: 'UpdateShoppingListPayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            name: 'Party',
          },
        },
      },
    });
    const { result } = render(answer);

    const settled = await settledBy(() =>
      result.current.sendFields({ ...fields, variables }),
    );

    expect(settled?.status).toBe('applied');
    expect(answer.fired).toEqual([variables]);
  });

  it('settles queued when the queue takes the write, never as a failure', async () => {
    const answer = recordMock(UpdateShoppingListDocument, {
      data: { updateShoppingList: null },
    });
    const { result } = render(answer);

    const settled = await settledBy(() =>
      result.current.sendFields({ ...fields, variables }),
    );

    expect(settled?.status).toBe('queued');
    expect(settled?.failure).toBeUndefined();
  });

  it('settles failed on a refusal, told in the copy the hook names', async () => {
    const answer = recordMock(UpdateShoppingListDocument, {
      data: {
        updateShoppingList: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'unknownField',
        },
      },
    });
    const { result, cache } = render(answer);

    const settled = await settledBy(() =>
      result.current.sendFields({ ...fields, variables }),
    );

    expect(settled?.status).toBe('failed');
    expect(settled?.failure?.body).toBe('Could not rename the list');
    // A refusal drops the pending layer: the row reads as the server holds it.
    expect(nameOf(cache)).toBe('Weekly');
  });

  it('shows the fields at once, before the server answers', async () => {
    const answer = recordMock(UpdateShoppingListDocument, { held: true });
    const { result, cache } = render(answer);

    await act(async () => {
      void result.current.sendFields({ ...fields, variables });
    });

    expect(nameOf(cache)).toBe('Party');
  });

  it("takes a send's own settle options over the hook's", async () => {
    const answer = recordMock(UpdateShoppingListDocument, {
      data: {
        updateShoppingList: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'unknownField',
        },
      },
    });
    const { result } = render(answer);

    const settled = await settledBy(() =>
      result.current.sendFields(
        { ...fields, variables },
        { settle: { fallback: 'Could not save this one' } },
      ),
    );

    expect(settled?.failure?.body).toBe('Could not save this one');
  });

  it('says a send is on its way until the server answers', async () => {
    const answer = recordMock(UpdateShoppingListDocument, { held: true });
    const { result } = render(answer);
    expect(result.current.sending).toBe(false);

    await act(async () => {
      void result.current.sendFields({ ...fields, variables });
      await log.requested(UpdateShoppingListDocument);
    });

    expect(result.current.sending).toBe(true);
  });

  it('sends what its ready step hands it, once that step is done', async () => {
    const answer = recordMock(UpdateShoppingListDocument, {
      data: { updateShoppingList: null },
    });
    const { result } = render(answer);
    const renamed = { input: { ...variables.input, name: 'Picnic' } };

    await settledBy(() =>
      result.current.send(variables, fields, {
        ready: async write => ({ ...write, variables: renamed }),
      }),
    );

    expect(answer.fired).toEqual([renamed]);
  });

  it('settles failed, unsent and untold, when its ready step leaves nothing to send', async () => {
    const answer = recordMock(UpdateShoppingListDocument, {
      data: { updateShoppingList: null },
    });
    const { result, cache } = render(answer);

    const settled = await settledBy(() =>
      result.current.send(variables, fields, { ready: async () => null }),
    );

    expect(settled).toEqual({ status: 'failed', data: undefined });
    expect(answer.fired).toEqual([]);
    expect(nameOf(cache)).toBe('Weekly');
  });
});
