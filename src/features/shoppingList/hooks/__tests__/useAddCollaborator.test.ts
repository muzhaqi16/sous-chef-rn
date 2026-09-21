import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { AddCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { CollaboratorRole, ErrorCode } from '#/graphql/generated/schemaTypes';
import { useAddCollaborator } from '#features/shoppingList/hooks/useAddCollaborator';

const INPUT = {
  shoppingListId: 'list-1',
  email: 'friend@example.com',
  role: CollaboratorRole.Contributor,
};

describe('useAddCollaborator', () => {
  it('settles a refused invite as not sent, with no error callback to wire', async () => {
    const { mock } = recordMock(AddCollaboratorDocument, {
      data: {
        inviteToShoppingList: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'Not allowed',
        },
      },
    });
    const { result } = renderHookWithApollo(() => useAddCollaborator(), {
      operationMocks: [mock],
    });

    await expect(result.current.addCollaborator(INPUT)).resolves.toBe(false);
  });

  it('settles a transport failure as not sent', async () => {
    const { mock } = recordMock(AddCollaboratorDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = renderHookWithApollo(() => useAddCollaborator(), {
      operationMocks: [mock],
    });

    await expect(result.current.addCollaborator(INPUT)).resolves.toBe(false);
  });

  it('settles an applied invite as sent', async () => {
    const { mock, fired } = recordMock(AddCollaboratorDocument, {
      data: {
        inviteToShoppingList: {
          __typename: 'InviteToShoppingListPayload',
          collaborator: { __typename: 'ShoppingListCollaborator', id: 'c-1' },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useAddCollaborator(), {
      operationMocks: [mock],
    });

    await expect(result.current.addCollaborator(INPUT)).resolves.toBe(true);
    expect(fired).toEqual([{ input: INPUT }]);
  });
});
