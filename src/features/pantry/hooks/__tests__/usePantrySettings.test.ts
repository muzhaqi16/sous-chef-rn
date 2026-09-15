import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { usePantrySettings } from '#features/pantry/hooks/usePantrySettings';
import { MarkPantryAsDefaultDocument } from '#features/pantry/graphql/pantry.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';

/**
 * `markPantryAsDefault` returns an errors-as-data union: a refusal arrives in
 * `data` with its own `__typename` and sets no `result.error` at all. Reading
 * the absence of an error as success puts the switch back on for a flag the
 * server refused to set.
 */
const markDefault = (payload: Record<string, unknown>): MockedResponse => ({
  request: {
    query: MarkPantryAsDefaultDocument,
    variables: { input: { id: 'pantry-1' } },
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
