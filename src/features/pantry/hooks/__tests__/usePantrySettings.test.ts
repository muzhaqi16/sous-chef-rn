import { gql } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import type { MockDataFor, MockFor } from '#/test-utils/apolloMockProvider';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { usePantrySettings } from '#features/pantry/hooks/usePantrySettings';
import {
  MarkPantryAsDefaultDocument,
  UpdatePantryDocument,
} from '#features/pantry/graphql/pantry.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';

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
    cache.writeFragment({
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
      delay: 20,
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

    await act(async () => {
      await Promise.all([
        result.current.setDefault('pantry-1'),
        result.current.savePantryFields('pantry-1', {
          name: 'Kitchen',
          description: '',
        }),
      ]);
    });

    expect(save.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ id: 'pantry-1', version: 6 }),
      }),
    ]);
  });
});
