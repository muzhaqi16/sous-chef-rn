import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { useUpdateHomeFields } from '../useUpdateHomeFields';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const FALLBACK = 'Failed to update home';

/**
 * Renaming a home is an absolute field set keyed by its id, so it queues like
 * any other field write and a replay lands the same state.
 */

const HOME_ID = 'home-1';

const HOME_FIELDS = gql`
  fragment _TestHomeFields on Home {
    name
    allowJoinCode
    version
  }
`;

const seedHome = () =>
  seedCache([
    {
      data: {
        __typename: 'Home',
        id: HOME_ID,
        name: 'Old Name',
        allowJoinCode: true,
        version: 3,
      },
      fragment: HOME_FIELDS,
      fragmentName: '_TestHomeFields',
    },
  ]);

const readHome = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ name: string; allowJoinCode: boolean }>({
    id: cache.identify({ __typename: 'Home', id: HOME_ID }),
    fragment: HOME_FIELDS,
    fragmentName: '_TestHomeFields',
  });

describe('updating a home field', () => {
  it('writes the cache before firing and sends the version with it', async () => {
    // Queued: the offline queue answers with a null payload.
    const update = recordMock(UpdateHomeDocument, {
      data: { updateHome: null },
    });
    const cache = seedHome();
    const { result } = renderHookWithApollo(
      () => useUpdateHomeFields(HOME_ID),
      { cache, operationMocks: [update.mock] },
    );

    await act(async () => {
      const pending = result.current.updateHomeFields(
        { name: 'New Name' },
        { ...readHome(cache), version: 3 },
        FALLBACK,
      );
      // Written before the server has answered anything.
      expect(readHome(cache)?.name).toBe('New Name');
      await pending;
    });

    expect(update.fired[0]).toMatchObject({
      input: { id: HOME_ID, name: 'New Name', version: 3 },
    });
    // Queued is not refused, so the rename stands.
    expect(readHome(cache)?.name).toBe('New Name');
  });

  // The revert reads its previous values off the CACHED ROW it was handed, so
  // this passes the row rather than a version stub.
  it('restores the previous value when the server refuses', async () => {
    const cache = seedHome();
    const { result } = renderHookWithApollo(
      () => useUpdateHomeFields(HOME_ID),
      {
        cache,
        operationMocks: [
          {
            request: { query: UpdateHomeDocument, variables: () => true },
            result: {
              data: {
                updateHome: {
                  __typename: 'ValidationError',
                  code: ErrorCode.ValidationFailed,
                  message: 'bad',
                  field: 'name',
                },
              },
            },
          },
        ],
      },
    );

    let persisted: boolean | undefined;
    await act(async () => {
      persisted = await result.current.updateHomeFields(
        { name: 'New Name' },
        { ...readHome(cache), version: 3 },
        FALLBACK,
      );
    });

    expect(persisted).toBe(false);
    expect(readHome(cache)?.name).toBe('Old Name');
    // Said once, and never in the server's own words.
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).not.toHaveBeenCalledWith(
      expect.anything(),
      'bad',
    );
  });

  it('clears the join-code flag through the same write', async () => {
    const update = recordMock(UpdateHomeDocument, {
      data: { updateHome: null },
    });
    const cache = seedHome();
    const { result } = renderHookWithApollo(
      () => useUpdateHomeFields(HOME_ID),
      { cache, operationMocks: [update.mock] },
    );

    await act(async () => {
      await result.current.updateHomeFields(
        { allowJoinCode: false },
        { ...readHome(cache), version: 3 },
        FALLBACK,
      );
    });

    expect(readHome(cache)?.allowJoinCode).toBe(false);
    expect(update.fired[0]).toMatchObject({
      input: { allowJoinCode: false },
    });
  });
});
