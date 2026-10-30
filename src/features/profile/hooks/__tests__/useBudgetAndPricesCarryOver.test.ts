import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import { useStore } from '#store';
import { useBudgetAndPricesCarryOver } from '../useBudgetAndPricesCarryOver';

const USER = {
  id: 'user-1',
  email: 'john@example.com',
  emailVerified: true,
  onBoarded: true,
};

const settingsRead = (budgetAndPrices: boolean | null) =>
  recordMock(GetUserSettingsDocument, {
    data: {
      me: {
        __typename: 'User',
        id: USER.id,
        settings: {
          __typename: 'UserSettings',
          id: 'settings-1',
          budgetAndPrices,
        },
      },
    },
  });

const run = async ({
  server,
  device,
}: {
  server: boolean | null;
  device: boolean;
}) => {
  useStore.setState({
    user: USER,
    userPreferences: {
      [USER.id]: { showShoppingListImages: true, budgetAndPrices: device },
    },
  });
  const read = settingsRead(server);
  const write = recordMock(UpdateUserPreferencesDocument, {
    data: { updateSettings: null },
  });
  const cache = makeCache();
  renderHookWithApollo(() => useBudgetAndPricesCarryOver(), {
    cache,
    operationMocks: [read.mock, write.mock],
  });
  // The answer has landed, so the hook has seen it.
  await drainTimers();
  expect(cache.readQuery({ query: GetUserSettingsDocument })).not.toBeNull();
  return write;
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useBudgetAndPricesCarryOver', () => {
  afterEach(() => {
    useStore.setState({ user: null, userPreferences: {} });
  });

  it("carries the device's on to an account with no answer, once", async () => {
    const write = await run({ server: null, device: true });

    await drainTimers();
    expect(write.fired).toEqual([
      { input: { shopping: { budgetAndPrices: true } } },
    ]);
  });

  // The device wrote `false` as a default on any preference change.
  it("never carries the device's off", async () => {
    const write = await run({ server: null, device: false });

    expect(write.fired).toEqual([]);
  });

  it('leaves an answered account alone', async () => {
    const write = await run({ server: false, device: true });

    expect(write.fired).toEqual([]);
  });
});
