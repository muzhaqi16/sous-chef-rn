import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreateStorageLocationDocument } from '#operations/storageLocation/storageLocation.generated';
import { StorageType } from '#/graphql/generated/schemaTypes';
import { useCreateStorageLocation } from '../useCreateStorageLocation';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const HOME_ID = 'home-1';
const PANTRY_ID = 'pantry-1';

// Matches the server id validator (cuid2 or legacy cuid v1 / 24-char hex).
const SERVER_ID_REGEX = /^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/;

function successMock() {
  return recordMock(CreateStorageLocationDocument, {
    data: (vars: Record<string, unknown>) => {
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
  it('mints a client id, sends it with the create, and returns the location', async () => {
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

    // Returned the created location (truthy entity, not false).
    expect(created).toMatchObject({ name: 'Spice Rack' });

    // A client-minted cuid2 rode the create as input.id, alongside the homeId.
    expect(fired).toHaveLength(1);
    const input = fired[0].input as {
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
});
