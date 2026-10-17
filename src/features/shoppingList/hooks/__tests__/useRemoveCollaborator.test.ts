import { gql } from '@apollo/client';
import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  type MockDataFor,
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { RemoveCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { useRemoveCollaborator } from '#features/shoppingList/hooks/useRemoveCollaborator';
import { useLeaveShoppingList } from '#features/shoppingList/hooks/useLeaveShoppingList';

type Answer = MockDataFor<
  typeof RemoveCollaboratorDocument
>['removeShoppingListCollaborator'];

const LIST_WITH_COLLABORATOR = gql`
  fragment SeedListCollaborators on ShoppingList {
    id
    collaboratorsConnection(first: 20) {
      totalCount
      edges {
        cursor
        node {
          id
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

const seededCache = () => {
  const cache = makeCache();
  cache.writeFragment({
    id: 'ShoppingList:list-1',
    fragment: LIST_WITH_COLLABORATOR,
    data: {
      __typename: 'ShoppingList',
      id: 'list-1',
      collaboratorsConnection: {
        __typename: 'ShoppingListCollaboratorConnection',
        totalCount: 1,
        edges: [
          {
            __typename: 'ShoppingListCollaboratorEdge',
            cursor: 'c',
            node: { __typename: 'ShoppingListCollaborator', id: 'collab-1' },
          },
        ],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    },
  });
  return cache;
};

const holdsCollaborator = (cache: ReturnType<typeof makeCache>) =>
  'ShoppingListCollaborator:collab-1' in cache.extract();

const APPLIED: Answer = {
  __typename: 'RemoveShoppingListCollaboratorPayload',
  converged: false,
  collaborator: { __typename: 'ShoppingListCollaborator', id: 'collab-1' },
};
// Removed twice: the server reads the missing row as the removal it asked for.
const CONVERGED: Answer = {
  __typename: 'RemoveShoppingListCollaboratorPayload',
  converged: true,
  collaborator: null,
};
// The list itself was deleted meanwhile, so there is no row to find.
const NOT_FOUND: Answer = {
  __typename: 'NotFoundError',
  code: ErrorCode.NotFound,
  resource: 'ShoppingListCollaborator',
};
const FORBIDDEN: Answer = {
  __typename: 'ForbiddenError',
  code: ErrorCode.Forbidden,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRemoveCollaborator', () => {
  const removeAnswered = async (answer: Answer) => {
    const { mock } = recordMock(RemoveCollaboratorDocument, {
      data: { removeShoppingListCollaborator: answer },
    });
    const cache = seededCache();
    const { result } = renderHookWithApollo(
      () => useRemoveCollaborator('list-1'),
      { operationMocks: [mock], cache },
    );
    let removed: boolean | undefined;
    await act(async () => {
      removed = await result.current.removeCollaborator('collab-1');
    });
    return { removed, cache };
  };

  it.each([
    ['removed', APPLIED],
    ['a repeat answered as converged', CONVERGED],
    ['a repeat answered as not found', NOT_FOUND],
  ])(
    'takes the collaborator out, with no error, when %s',
    async (_, answer) => {
      const { removed, cache } = await removeAnswered(answer);

      expect(removed).toBe(true);
      expect(holdsCollaborator(cache)).toBe(false);
      expect(alertService.alert).not.toHaveBeenCalled();
    },
  );

  it('keeps the collaborator and shows a refusal that is not a removal', async () => {
    const { removed, cache } = await removeAnswered(FORBIDDEN);

    expect(removed).toBe(false);
    expect(holdsCollaborator(cache)).toBe(true);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });
});

describe('useLeaveShoppingList', () => {
  const leaveAnswered = async (answer: Answer) => {
    const { mock } = recordMock(RemoveCollaboratorDocument, {
      data: { removeShoppingListCollaborator: answer },
    });
    const cache = seededCache();
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const { result } = renderHookWithApollo(
      () => useLeaveShoppingList('list-1'),
      { operationMocks: [mock], cache },
    );
    await act(async () => {
      await result.current.leaveList('collab-1', { onSuccess, onError });
    });
    return { cache, onSuccess, onError };
  };

  it.each([
    ['left', APPLIED],
    ['a repeat answered as converged', CONVERGED],
    ['a repeat answered as not found', NOT_FOUND],
  ])('leaves the list, with no error, when %s', async (_, answer) => {
    const { cache, onSuccess, onError } = await leaveAnswered(answer);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(holdsCollaborator(cache)).toBe(false);
  });

  it('stays on the list and reports a refusal that is not a removal', async () => {
    const { cache, onSuccess, onError } = await leaveAnswered(FORBIDDEN);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(holdsCollaborator(cache)).toBe(true);
  });
});
