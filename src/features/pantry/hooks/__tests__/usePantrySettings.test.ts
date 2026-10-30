import { gql } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import type { MockDataFor, MockFor } from '#/test-utils/apolloMockProvider';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { usePantrySettings } from '#features/pantry/hooks/usePantrySettings';
import {
  MarkPantryAsDefaultDocument,
  UpdatePantryDocument,
} from '#features/pantry/graphql/pantry.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { todayKey } from '#/utils/dateUtils';

beforeEach(() => jest.clearAllMocks());

/**
 * `markPantryAsDefault` returns an errors-as-data union: a refusal arrives in
 * `data` with its own `__typename` and sets no `result.error` at all. Reading
 * the absence of an error as success puts the switch back on for a flag the
 * server refused to set.
 */
const markDefault = (
  payload: Record<string, unknown>,
): MockFor<typeof MarkPantryAsDefaultDocument> => ({
  request: {
    query: MarkPantryAsDefaultDocument,
    variables: ({ input }) => input.id === 'pantry-1',
  },
  result: { data: { markPantryAsDefault: payload } },
});

const renderSettings = (mocks: MockedResponse[]) =>
  renderHookWithApollo(
    () => usePantrySettings({ pantryId: 'pantry-1', homeId: 'home-1' }),
    { operationMocks: mocks },
  );

describe('usePantrySettings.setDefault', () => {
  it('reports a refusal as failure, not success', async () => {
    const { result } = renderSettings([
      markDefault({
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'not allowed',
        field: 'id',
      }),
    ]);

    await waitFor(() => expect(result.current.setDefault).toBeDefined());
    await expect(result.current.setDefault('pantry-1')).resolves.toBe(false);
  });

  it('reports a NotFoundError as failure', async () => {
    const { result } = renderSettings([
      markDefault({
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'gone',
        resource: 'Pantry',
        resourceId: 'pantry-1',
      }),
    ]);

    await waitFor(() => expect(result.current.setDefault).toBeDefined());
    await expect(result.current.setDefault('pantry-1')).resolves.toBe(false);
  });

  it('keeps the switch on for a write the offline queue took', async () => {
    // The queue resolves a queued write with its payload field null. Reading
    // that as a refusal put the switch back while the write stayed queued.
    const { result } = renderSettings([
      recordMock(MarkPantryAsDefaultDocument, {
        data: { markPantryAsDefault: null },
        partial: true,
      }).mock,
    ]);

    await waitFor(() => expect(result.current.setDefault).toBeDefined());
    await expect(result.current.setDefault('pantry-1')).resolves.toBe(true);
  });

  it('reports the success payload as success', async () => {
    const { result } = renderSettings([
      markDefault({
        __typename: 'MarkPantryAsDefaultPayload',
        pantry: {
          __typename: 'Pantry',
          id: 'pantry-1',
          name: 'Kitchen',
          isDefault: true,
          homeId: 'home-1',
        },
      }),
    ]);

    await waitFor(() => expect(result.current.setDefault).toBeDefined());
    await expect(result.current.setDefault('pantry-1')).resolves.toBe(true);
  });
});

describe('usePantrySettings, a toggle and a save inside one round trip', () => {
  // The default toggle moves the pantry's version server-side, and a save
  // sent alongside it at the old one was refused as changed elsewhere.
  it('sends the save at the version the toggle answered with', async () => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: gql`
        fragment SeedPantryVersion on Pantry {
          id
          version
        }
      `,
      data: { __typename: 'Pantry', id: 'pantry-1', version: 5 },
    });
    const markDefaultMock = recordMock(MarkPantryAsDefaultDocument, {
      data: {
        markPantryAsDefault: {
          __typename: 'MarkPantryAsDefaultPayload',
          pantry: { __typename: 'Pantry', id: 'pantry-1', version: 6 },
        },
      },
      held: true,
    });
    const save = recordMock(UpdatePantryDocument, {
      dataFor: (vars): MockDataFor<typeof UpdatePantryDocument> => ({
        updatePantry: {
          __typename: 'UpdatePantryPayload',
          pantry: {
            __typename: 'Pantry',
            id: 'pantry-1',
            version: Number(inputOf(vars).version) + 1,
          },
        },
      }),
    });
    const { result } = renderHookWithApollo(
      () => usePantrySettings({ pantryId: 'pantry-1', homeId: 'home-1' }),
      { operationMocks: [markDefaultMock.mock, save.mock], cache },
    );

    let both: Promise<unknown> = Promise.resolve();
    await act(async () => {
      both = Promise.all([
        result.current.setDefault('pantry-1'),
        result.current.savePantryFields('pantry-1', {
          name: 'Kitchen',
          description: '',
        }),
      ]);
    });
    // The save waits for the toggle's answer.
    expect(markDefaultMock.fired).toHaveLength(1);
    expect(save.fired).toEqual([]);

    await act(async () => {
      markDefaultMock.release();
      await both;
    });

    expect(save.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ id: 'pantry-1', version: 6 }),
      }),
    ]);
  });
});

describe('usePantrySettings.savePantryFields', () => {
  const PANTRY_ROW = gql`
    fragment SeedPantryRow on Pantry {
      id
      name
      description
    }
  `;
  const PANTRY_VERSION = gql`
    fragment SeedPantryRowVersion on Pantry {
      id
      version
    }
  `;
  const seedRow = (version?: number) => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: PANTRY_ROW,
      data: {
        __typename: 'Pantry',
        id: 'pantry-1',
        name: 'Larder',
        description: 'Cold room',
      },
    });
    if (version !== undefined) {
      seedFragment(cache, {
        fragment: PANTRY_VERSION,
        data: { __typename: 'Pantry', id: 'pantry-1', version },
      });
    }
    return cache;
  };
  const readRow = (cache: ReturnType<typeof makeCache>) =>
    cache.readFragment<{ name: string; description: string }>({
      id: 'Pantry:pantry-1',
      fragment: PANTRY_ROW,
    });
  const saveMock = () =>
    recordMock(UpdatePantryDocument, {
      dataFor: (vars): MockDataFor<typeof UpdatePantryDocument> => ({
        updatePantry: {
          __typename: 'UpdatePantryPayload',
          pantry: {
            __typename: 'Pantry',
            id: 'pantry-1',
            name: String(inputOf(vars).name),
            description: String(inputOf(vars).description),
            version: Number(inputOf(vars).version) + 1,
          },
        },
      }),
    });

  it('states the version the cache holds on the save', async () => {
    const cache = seedRow(5);
    const save = saveMock();
    const { result } = renderHookWithApollo(
      () => usePantrySettings({ pantryId: 'pantry-1', homeId: 'home-1' }),
      { operationMocks: [save.mock], cache },
    );

    let saved: unknown = 'unset';
    await act(async () => {
      saved = await result.current.savePantryFields('pantry-1', {
        name: 'Kitchen',
        description: '',
      });
    });

    expect(saved).toBe(true);
    expect(save.fired).toEqual([
      {
        input: { id: 'pantry-1', name: 'Kitchen', description: '', version: 5 },
        today: todayKey(),
      },
    ]);
    expect(readRow(cache)).toMatchObject({ name: 'Kitchen', description: '' });
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  // A row the home screens cached carries `name` and no `version`
  // (`HomeDetailScreen_home`), and the settings read has not answered yet.
  it('leaves the cached row as it was when the save is not sent', async () => {
    const cache = seedRow();
    const { result } = renderHookWithApollo(
      () => usePantrySettings({ pantryId: 'pantry-1', homeId: 'home-1' }),
      { operationMocks: [saveMock().mock], cache },
    );

    await act(async () => {
      await result.current.savePantryFields('pantry-1', {
        name: 'Kitchen',
        description: '',
      });
    });

    expect(readRow(cache)).toMatchObject({
      name: 'Larder',
      description: 'Cold room',
    });
  });
});
