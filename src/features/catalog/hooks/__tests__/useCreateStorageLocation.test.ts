import { act } from '@testing-library/react-native';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreateStorageLocationDocument,
  GetStorageLocationsDocument,
} from '#features/catalog/graphql/storageLocation.generated';
import { makeCache } from '#/apollo/cache';
import { StorageType } from '#/graphql/generated/schemaTypes';
import { useCreateStorageLocation } from '#features/catalog/hooks/useCreateStorageLocation';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const HOME_ID = 'home-1';
const PANTRY_ID = 'pantry-1';

// Matches the server id validator (cuid2 or legacy cuid v1 / 24-char hex).
const SERVER_ID_REGEX = /^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/;

function successMock() {
  return recordMock(CreateStorageLocationDocument, {
    dataFor: (
      vars: Record<string, unknown>,
    ): MockDataFor<typeof CreateStorageLocationDocument> => {
      const input = vars.input as { id: string; name: string };
      return {
        createStorageLocation: {
          __typename: 'CreateStorageLocationPayload',
          storageLocation: {
            __typename: 'StorageLocation',
            id: input.id,
            name: input.name,
            type: StorageType.PantryShelf,
            icon: null,
            color: null,
            temperature: null,
            description: null,
            isClimateControlled: false,
            capacity: null,
            capacityUnit: null,
            sortOrder: 0,
            isDefault: false,
            currentItemCount: 0,
            homeId: HOME_ID,
            parentLocation: null,
          },
        },
      };
    },
  });
}

describe('useCreateStorageLocation', () => {
  it('mints a client id, sends it with the create, and reports success', async () => {
    const { fired, mock } = successMock();
    const { result } = renderHookWithApollo(
      () => useCreateStorageLocation(HOME_ID, PANTRY_ID),
      { operationMocks: [mock] },
    );

    let created: unknown;
    await act(async () => {
      created = await result.current.createLocation({
        name: 'Spice Rack',
        type: StorageType.PantryShelf,
      });
    });

    expect(created).toBe(true);

    // A client-minted cuid2 rode the create as input.id, alongside the homeId.
    expect(fired).toHaveLength(1);
    const input = fired[0]!.input as {
      id: string;
      name: string;
      homeId: string;
    };
    expect(input.id).toMatch(SERVER_ID_REGEX);
    expect(input.name).toBe('Spice Rack');
    expect(input.homeId).toBe(HOME_ID);
  });

  it('returns false when homeId is missing (no mutation fired)', async () => {
    const { fired, mock } = successMock();
    const { result } = renderHookWithApollo(
      () => useCreateStorageLocation(undefined, PANTRY_ID),
      { operationMocks: [mock] },
    );

    let created: unknown = 'unset';
    await act(async () => {
      created = await result.current.createLocation({
        name: 'Spice Rack',
        type: StorageType.PantryShelf,
      });
    });

    expect(created).toBe(false);
    expect(fired).toHaveLength(0);
  });

  it("adds the new location to its own home's list only", async () => {
    const cache = makeCache();
    const seedEmpty = (homeId: string) =>
      cache.writeQuery({
        query: GetStorageLocationsDocument,
        variables: { homeId },
        data: {
          __typename: 'Query',
          storageLocations: {
            __typename: 'StorageLocationConnection',
            edges: [],
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: 0,
          },
        },
      });
    seedEmpty(HOME_ID);
    seedEmpty('home-2');

    const { mock } = successMock();
    const { result } = renderHookWithApollo(
      () => useCreateStorageLocation(HOME_ID, PANTRY_ID),
      { cache, operationMocks: [mock] },
    );
    await act(async () => {
      await result.current.createLocation({
        name: 'Spice Rack',
        type: StorageType.PantryShelf,
      });
    });

    const namesIn = (homeId: string) =>
      cache
        .readQuery({
          query: GetStorageLocationsDocument,
          variables: { homeId },
        })
        ?.storageLocations.edges.map(edge => edge.node.name);
    expect(namesIn(HOME_ID)).toEqual(['Spice Rack']);
    expect(namesIn('home-2')).toEqual([]);
  });

  it('shows a queued location from its local row alone', async () => {
    const cache = makeCache();
    cache.writeQuery({
      query: GetStorageLocationsDocument,
      variables: { homeId: HOME_ID },
      data: {
        __typename: 'Query',
        storageLocations: {
          __typename: 'StorageLocationConnection',
          edges: [],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          totalCount: 0,
        },
      },
    });
    const queued = recordMock(CreateStorageLocationDocument, {
      data: { createStorageLocation: null },
    });
    const { result } = renderHookWithApollo(
      () => useCreateStorageLocation(HOME_ID, PANTRY_ID),
      { cache, operationMocks: [queued.mock] },
    );

    await act(async () => {
      await result.current.createLocation({
        name: 'Spice Rack',
        type: StorageType.PantryShelf,
      });
    });

    // A strict read: one field the row lacks and the whole list reads empty.
    expect(
      cache
        .readQuery({
          query: GetStorageLocationsDocument,
          variables: { homeId: HOME_ID },
        })
        ?.storageLocations.edges.map(edge => edge.node.name),
    ).toEqual(['Spice Rack']);
  });
});
