import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  dropUnitSystemAnswers,
  reconcileSettingsReplay,
  refreshDeviceUnitSystem,
} from '#/apollo/utils/unitSystemAnswers';
import { completeMockedResponse } from '#/test-utils/apolloMockProvider';
import {
  GetUserSettingsDocument,
  type GetUserSettingsQuery,
} from '#operations/auth/user.generated';
import { UnitSystem } from '#/graphql/generated/schemaTypes';

const rootFields = (cache: ReturnType<typeof makeCache>) =>
  Object.keys(cache.extract().ROOT_QUERY ?? {});

describe('dropUnitSystemAnswers', () => {
  it('drops both pickers, so each is asked again in the new system', () => {
    const cache = makeCache();
    cache.restore({
      ROOT_QUERY: {
        __typename: 'Query',
        'consumptionUnitsForPantryItem({"pantryItemId":"p1"})': [],
        'restockUnitsForPantryItem({"pantryItemId":"p1"})': [],
        me: null,
      },
    });

    dropUnitSystemAnswers(cache);

    expect(rootFields(cache)).toEqual(['__typename', 'me']);
  });
});

describe('reconcileSettingsReplay', () => {
  const replay = (input: Record<string, unknown>) => {
    const cache = makeCache();
    cache.restore({
      ROOT_QUERY: {
        __typename: 'Query',
        'consumptionUnitsForPantryItem({"pantryItemId":"p1"})': [],
      },
    });
    reconcileSettingsReplay(cache, { input }, null);
    return rootFields(cache);
  };

  it('drops the pickers when the replayed write set the unit system', () => {
    expect(replay({ regional: { preferredUnitSystem: 'IMPERIAL' } })).toEqual([
      '__typename',
    ]);
  });

  it('keeps them for a settings write that left the unit system alone', () => {
    expect(replay({ regional: { language: 'es' } })).toContain(
      'consumptionUnitsForPantryItem({"pantryItemId":"p1"})',
    );
    expect(replay({ ui: { theme: 'DARK' } })).toContain(
      'consumptionUnitsForPantryItem({"pantryItemId":"p1"})',
    );
  });
});

/** The settings as the server answers them, SYSTEM reading as `device`. */
function settingsAnswer(device: UnitSystem): Unmasked<GetUserSettingsQuery> {
  const completed = completeMockedResponse({
    request: { query: GetUserSettingsDocument, variables: {} },
    result: {
      data: {
        me: {
          id: 'user-1',
          settings: {
            id: 'settings-1',
            preferredUnitSystem: UnitSystem.System,
            deviceUnitSystem: device,
          },
        },
      },
    },
  }).result as (vars: Record<string, never>) => {
    data: Unmasked<GetUserSettingsQuery>;
  };
  return completed({}).data;
}

describe('refreshDeviceUnitSystem', () => {
  let answer: (result: ApolloLink.Result | Error) => void;
  let client: ApolloClient;

  beforeEach(() => {
    client = new ApolloClient({
      cache: makeCache(),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
      link: new ApolloLink(
        () =>
          new Observable(observer => {
            answer = result => {
              if (result instanceof Error) {
                observer.error(result);
                return;
              }
              observer.next(result);
              observer.complete();
            };
          }),
      ),
    });
    client.cache.writeQuery({
      query: GetUserSettingsDocument,
      data: settingsAnswer(UnitSystem.Imperial),
    });
  });

  const deviceSystem = () =>
    client.cache.readQuery({ query: GetUserSettingsDocument })?.me?.settings
      ?.deviceUnitSystem;

  // Evicted instead, every settings read went incomplete and amounts fell
  // back to metric until the answer landed.
  it('keeps the settings readable until the new answer lands over them', async () => {
    const refreshed = refreshDeviceUnitSystem(client);
    expect(deviceSystem()).toBe(UnitSystem.Imperial);

    answer({ data: settingsAnswer(UnitSystem.Metric) });
    await refreshed;

    expect(deviceSystem()).toBe(UnitSystem.Metric);
  });

  it('keeps the last known system when the re-read fails', async () => {
    const refreshed = refreshDeviceUnitSystem(client);
    answer(new Error('Network request failed'));
    await refreshed;

    expect(deviceSystem()).toBe(UnitSystem.Imperial);
  });
});
