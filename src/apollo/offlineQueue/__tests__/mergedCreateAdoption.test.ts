/**
 * Writes still queued behind a replay are moved onto what the server answered:
 * the version an edit returned, and the row a merged create survives as. Both
 * are written to the queue itself, so a restart mid-drain keeps them.
 */
import { makeCache } from '#/apollo/cache';
import { storage } from '#storage/mmkv';
import { useStore } from '#store';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  DeletePantryItemDocument,
  RestockPantryItemDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  AddItemToShoppingListDocument,
  ToggleShoppingListItemPurchasedDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  CreateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
  UpdateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { t } from '#/i18n';
import { handleQueueFailure } from '../queueFailureHandler';
import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import { QueueStatus } from '../types';

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn(),
  },
}));

const mockClient = {
  mutate: jest.fn(),
  query: jest.fn(),
  refetchQueries: jest.fn(() => Promise.resolve([])),
  cache: makeCache(),
};
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));
// The failure handler withdraws through the app's client; here it is the same
// one, read lazily since the handler's import runs before `mockClient` exists.
jest.mock('#/apollo/client', () => ({
  get client() {
    return mockClient;
  },
}));
jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

// Within the queue's 90-day horizon, in the order the writes were made.
const NOW = Date.now();

const pantryItemPayload = (id: string, version: number) => ({
  __typename: 'UpdatePantryItemPayload',
  pantryItem: { __typename: 'PantryItem', id, version },
});

const stackAt = (version: number) => ({
  __typename: 'PantryItem',
  id: 'row-1',
  version,
});

/** The server holds `row-1` at `serverVersion` and refuses a set at any other. */
const quantitySetAgainst =
  (serverVersion: number) =>
  ({ variables }: { variables: { input: { version?: number } } }) =>
    Promise.resolve({
      data: {
        updatePantryItemQuantity:
          variables.input.version === serverVersion
            ? {
                __typename: 'UpdatePantryItemQuantityPayload',
                pantryItem: stackAt(serverVersion + 1),
              }
            : {
                __typename: 'ConflictError',
                code: ErrorCode.VersionConflict,
                message: 'The pantry item changed',
              },
      },
    });

const queueQuantitySetAtV5 = () =>
  queueStore.addMutation(
    makeQueuedMutation({
      id: 'set',
      ...queuedMutationFor(UpdatePantryItemQuantityDocument),
      variables: {
        input: { pantryItemId: 'row-1', quantity: '4', version: 5 },
      },
      createdAt: NOW + 1,
    }),
  );

const sentInputs = () =>
  mockClient.mutate.mock.calls.map(
    ([options]: [{ variables: { input: unknown } }]) => options.variables.input,
  );

beforeEach(() => {
  jest.clearAllMocks();
  storage.clearAll();
  queueStore.invalidateCache();
  queueStore.setCurrentUserId('user-1');
  mockClient.cache = makeCache();
  (useStore.getState as jest.Mock).mockReturnValue({
    user: { id: 'user-1' },
    isOnline: true,
    apiReachable: true,
    accessToken: 'token',
  });
});

describe('writes queued behind a replay', () => {
  it('are sent at the version the replay returned, and keep it in the queue', async () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'rename',
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: { input: { id: 'row-1', itemName: 'Oat milk', version: 2 } },
        createdAt: NOW,
      }),
    );
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'note',
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: { input: { id: 'row-1', storageNotes: 'Top', version: 2 } },
        createdAt: NOW + 1,
      }),
    );
    mockClient.mutate
      .mockResolvedValueOnce({
        data: { updatePantryItem: pantryItemPayload('row-1', 3) },
      })
      .mockImplementationOnce(() => {
        // Read back as a restart would: the move is in the queue itself.
        queueStore.invalidateCache();
        expect(queueStore.getMutation('note')?.variables.input).toMatchObject({
          version: 3,
        });
        return Promise.resolve({
          data: { updatePantryItem: pantryItemPayload('row-1', 4) },
        });
      });

    await new QueueManager().processQueue();

    expect(sentInputs()).toEqual([
      expect.objectContaining({ itemName: 'Oat milk', version: 2 }),
      expect.objectContaining({ storageNotes: 'Top', version: 3 }),
    ]);
  });

  it('are sent past a versionless change the device made first', async () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'usage',
        ...queuedMutationFor(CreatePantryItemUsageDocument),
        variables: {
          input: {
            pantryItemId: 'row-1',
            amount: { quantity: 1 },
            purpose: 'CONSUMED',
          },
        },
        createdAt: NOW,
      }),
    );
    queueQuantitySetAtV5();
    mockClient.mutate
      .mockResolvedValueOnce({
        data: {
          createPantryItemUsage: {
            __typename: 'CreatePantryItemUsagePayload',
            pantryItemUsage: {
              __typename: 'PantryItemUsage',
              id: 'usage-1',
              pantryItem: stackAt(6),
            },
          },
        },
      })
      .mockImplementationOnce(options => {
        queueStore.invalidateCache();
        expect(queueStore.getMutation('set')?.variables.input).toMatchObject({
          version: 6,
        });
        return quantitySetAgainst(6)(options);
      });

    await new QueueManager().processQueue();

    expect(sentInputs()[1]).toMatchObject({ version: 6 });
    expect(queueStore.getMutation('set')?.status).toBe(QueueStatus.SUCCESS);
  });

  it('are sent past a versionless restock the device made first', async () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'restock',
        ...queuedMutationFor(RestockPantryItemDocument),
        variables: {
          input: { id: 'row-1', quantity: 2, idempotencyKey: 'restock-1' },
        },
        createdAt: NOW,
      }),
    );
    queueQuantitySetAtV5();
    mockClient.mutate
      .mockResolvedValueOnce({
        data: {
          restockPantryItem: {
            __typename: 'RestockPantryItemPayload',
            pantryItem: stackAt(6),
          },
        },
      })
      .mockImplementationOnce(quantitySetAgainst(6));

    await new QueueManager().processQueue();

    expect(sentInputs()[1]).toMatchObject({ version: 6 });
    expect(queueStore.getMutation('set')?.status).toBe(QueueStatus.SUCCESS);
  });

  it('still conflict when another device changed the entry in between', async () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'usage',
        ...queuedMutationFor(CreatePantryItemUsageDocument),
        variables: {
          input: {
            pantryItemId: 'row-1',
            amount: { quantity: 1 },
            purpose: 'CONSUMED',
          },
        },
        createdAt: NOW,
      }),
    );
    queueQuantitySetAtV5();
    mockClient.mutate
      .mockResolvedValueOnce({
        data: {
          createPantryItemUsage: {
            __typename: 'CreatePantryItemUsagePayload',
            pantryItemUsage: {
              __typename: 'PantryItemUsage',
              id: 'usage-1',
              pantryItem: stackAt(7),
            },
          },
        },
      })
      .mockImplementationOnce(quantitySetAgainst(7));

    await new QueueManager().processQueue();

    expect(sentInputs()[1]).toMatchObject({ version: 5 });
    expect(queueStore.getMutation('set')).toMatchObject({
      status: QueueStatus.FAILED,
      lastError: { type: 'conflict' },
    });
  });

  it('move to the row a merged create survives as, at its version', async () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'create',
        ...queuedMutationFor(CreatePantryItemDocument),
        variables: {
          input: {
            id: 'minted-1',
            pantryId: 'pantry-1',
            item: { inline: { name: 'Milk' } },
            quantity: 1,
          },
        },
        createdAt: NOW,
      }),
    );
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'rename',
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: {
          input: { id: 'minted-1', itemName: 'Oat milk', version: 1 },
        },
        createdAt: NOW + 1,
      }),
    );
    mockClient.mutate
      .mockResolvedValueOnce({
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            outcome: 'MERGED',
            pantryItem: {
              __typename: 'PantryItem',
              id: 'surviving-1',
              version: 5,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: { updatePantryItem: pantryItemPayload('surviving-1', 6) },
      });

    await new QueueManager().processQueue();

    expect(sentInputs()).toEqual([
      expect.objectContaining({ id: 'minted-1', forceAdd: true }),
      { id: 'surviving-1', itemName: 'Oat milk', version: 5 },
    ]);
  });
});

describe("a merged create's queued writes", () => {
  const queuePantryCreate = (overrides: { status?: QueueStatus } = {}) =>
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'create',
        ...queuedMutationFor(CreatePantryItemDocument),
        variables: {
          input: {
            id: 'minted-1',
            pantryId: 'pantry-1',
            item: { inline: { name: 'Milk' } },
            quantity: 2,
          },
        },
        createdAt: NOW,
        ...overrides,
      }),
    );
  const pantryMerge = {
    data: {
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        outcome: 'MERGED',
        pantryItem: { __typename: 'PantryItem', id: 'surviving-1', version: 5 },
      },
    },
  };
  const queueAfterCreate = (
    id: string,
    document: Parameters<typeof queuedMutationFor>[0],
    input: Record<string, unknown>,
    offset = 1,
  ) =>
    queueStore.addMutation(
      makeQueuedMutation({
        id,
        ...queuedMutationFor(document),
        variables: { input },
        createdAt: NOW + offset,
      }),
    );
  const queueShoppingAdd = () =>
    queueAfterCreate(
      'add',
      AddItemToShoppingListDocument,
      {
        shoppingListId: 'list-1',
        items: [{ id: 'minted-2', item: { inline: { name: 'Milk' } } }],
      },
      0,
    );
  const shoppingMerge = {
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [
          {
            __typename: 'BatchAddShoppingListItemResult',
            index: 0,
            success: true,
            item: {
              __typename: 'ShoppingListItem',
              id: 'surviving-2',
              version: 3,
            },
          },
        ],
      },
    },
  };
  const managerWithHandlers = () => {
    const manager = new QueueManager();
    const failed = jest.fn();
    const kept = jest.fn();
    manager.setFailureHandler(failed);
    manager.setRemovalKeptHandler(kept);
    return { manager, failed, kept };
  };

  it('drop a removal of the created entry, and say the shared one stays', async () => {
    queuePantryCreate({ status: QueueStatus.AUTH_ERROR });
    queueAfterCreate('delete', DeletePantryItemDocument, { id: 'minted-1' });
    queueStore.revivePendingAuthErrors('user-1');
    mockClient.mutate.mockResolvedValueOnce(pantryMerge);
    const { manager, failed, kept } = managerWithHandlers();

    await manager.processQueue();

    expect(mockClient.mutate).toHaveBeenCalledTimes(1);
    expect(queueStore.getMutation('delete')).toBeNull();
    expect(failed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('drop a removal queued while the create was replaying', async () => {
    queuePantryCreate();
    mockClient.mutate.mockImplementationOnce(() => {
      queueAfterCreate('delete', DeletePantryItemDocument, { id: 'minted-1' });
      return Promise.resolve(pantryMerge);
    });
    const { manager, failed, kept } = managerWithHandlers();

    await manager.processQueue();

    expect(mockClient.mutate).toHaveBeenCalledTimes(1);
    expect(queueStore.getMutation('delete')).toBeNull();
    expect(failed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('withdraw a quantity overwrite as a conflict on the created entry', async () => {
    queuePantryCreate();
    queueAfterCreate('set', UpdatePantryItemQuantityDocument, {
      pantryItemId: 'minted-1',
      quantity: '4',
      version: 1,
    });
    mockClient.mutate.mockResolvedValueOnce(pantryMerge);
    const { manager, failed, kept } = managerWithHandlers();

    await manager.processQueue();

    expect(mockClient.mutate).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationId: 'set',
        entityId: 'minted-1',
        error: expect.objectContaining({ type: 'conflict' }),
      }),
    );
    expect(queueStore.getMutation('set')?.status).toBe(QueueStatus.FAILED);
    expect(kept).not.toHaveBeenCalled();
  });

  it('leave the merged entry as the service stated it, and say the overwrite lost', async () => {
    // Held by the detail reads, as on device; unreachable rows are collected.
    mockClient.cache.restore({
      ROOT_QUERY: {
        __typename: 'Query',
        'pantryItem({"id":"minted-1"})': { __ref: 'PantryItem:minted-1' },
        'pantryItem({"id":"surviving-1"})': { __ref: 'PantryItem:surviving-1' },
      },
      'PantryItem:minted-1': {
        __typename: 'PantryItem',
        id: 'minted-1',
        quantity: 4,
      },
      'PantryItem:surviving-1': {
        __typename: 'PantryItem',
        id: 'surviving-1',
        quantity: 5,
        version: 5,
      },
    });
    queuePantryCreate();
    queueAfterCreate('set', UpdatePantryItemQuantityDocument, {
      pantryItemId: 'minted-1',
      quantity: '4',
      version: 1,
    });
    mockClient.mutate.mockResolvedValueOnce(pantryMerge);
    const manager = new QueueManager();
    manager.setFailureHandler(handleQueueFailure);

    await manager.processQueue();

    const held = mockClient.cache.extract();
    expect(held['PantryItem:minted-1']).toBeUndefined();
    expect(held['PantryItem:surviving-1']).toMatchObject({ quantity: 5 });
    expect(toastService.error).toHaveBeenCalledWith(
      t('errors.queuedChangeOverwrittenResource', {
        resource: t('errors.resourceNames.PantryItem'),
      }),
    );
  });

  it('withdraw an edit that sets the quantity of a merged shopping line', async () => {
    queueShoppingAdd();
    queueAfterCreate('edit', UpdateShoppingListItemDocument, {
      id: 'minted-2',
      quantity: 3,
      version: 1,
    });
    mockClient.mutate.mockResolvedValueOnce(shoppingMerge);
    const { manager, failed } = managerWithHandlers();

    await manager.processQueue();

    expect(mockClient.mutate).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationId: 'edit',
        entityId: 'minted-2',
        error: expect.objectContaining({ type: 'conflict' }),
      }),
    );
  });

  it('carry a consumption and a check-off onto the merged entries', async () => {
    queuePantryCreate();
    queueShoppingAdd();
    queueAfterCreate(
      'usage',
      CreatePantryItemUsageDocument,
      {
        pantryItemId: 'minted-1',
        amount: { quantity: 1 },
        purpose: 'CONSUMED',
      },
      2,
    );
    queueAfterCreate(
      'check',
      ToggleShoppingListItemPurchasedDocument,
      { id: 'minted-2', purchased: true, version: 1 },
      3,
    );
    mockClient.mutate
      .mockResolvedValueOnce(pantryMerge)
      .mockResolvedValueOnce(shoppingMerge)
      .mockResolvedValue({ data: {} });
    const { manager, failed, kept } = managerWithHandlers();

    await manager.processQueue();

    expect(sentInputs().slice(2)).toEqual([
      expect.objectContaining({ pantryItemId: 'surviving-1' }),
      { id: 'surviving-2', purchased: true, version: 3 },
    ]);
    expect(failed).not.toHaveBeenCalled();
    expect(kept).not.toHaveBeenCalled();
  });

  it('leave nothing persisted under the created entry', async () => {
    optimisticDataPersistence.save('PantryItem', 'minted-1', 'quantity', 4);
    optimisticDataPersistence.flush();
    queuePantryCreate();
    queueAfterCreate('rename', UpdatePantryItemDocument, {
      id: 'minted-1',
      itemName: 'Oat milk',
      version: 1,
    });
    mockClient.mutate.mockResolvedValueOnce(pantryMerge).mockResolvedValueOnce({
      data: { updatePantryItem: pantryItemPayload('surviving-1', 6) },
    });

    await new QueueManager().processQueue();

    expect(optimisticDataPersistence.get('PantryItem', 'minted-1')).toEqual({});
  });

  it('follow a meal the service merged into one already planned', async () => {
    queueAfterCreate(
      'plan',
      CreateMealPlanItemDocument,
      {
        id: 'm1',
        mealPlanId: 'plan-1',
        date: '2026-10-01T00:00:00.000Z',
        mealType: 'DINNER',
        meal: { recipeId: 'recipe-1' },
      },
      0,
    );
    queueAfterCreate('done', UpdateMealPlanItemDocument, {
      id: 'm1',
      isCompleted: true,
    });
    mockClient.mutate
      .mockResolvedValueOnce({
        data: {
          createMealPlanItem: {
            __typename: 'CreateMealPlanItemPayload',
            mealPlanItem: { __typename: 'MealPlanItem', id: 's1' },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          updateMealPlanItem: {
            __typename: 'UpdateMealPlanItemPayload',
            mealPlanItem: { __typename: 'MealPlanItem', id: 's1' },
          },
        },
      });
    const { manager, failed } = managerWithHandlers();

    await manager.processQueue();

    expect(sentInputs()[1]).toEqual({ id: 's1', isCompleted: true });
    expect(failed).not.toHaveBeenCalled();
  });

  it('settle a removal of a meal the service no longer has', async () => {
    queueAfterCreate('remove', DeleteMealPlanItemDocument, { id: 'gone-1' }, 0);
    mockClient.mutate.mockResolvedValueOnce({
      data: {
        deleteMealPlanItem: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          message: 'MealPlanItem not found',
          resource: 'MealPlanItem',
        },
      },
    });
    const { manager, failed } = managerWithHandlers();

    await manager.processQueue();

    expect(failed).not.toHaveBeenCalled();
    expect(queueStore.getMutation('remove')?.status).toBe(QueueStatus.SUCCESS);
  });
});
