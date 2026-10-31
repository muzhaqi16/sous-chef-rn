import { act } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { usePreferredCurrency } from '#/domain/money';
import { DEFAULT_CURRENCY } from '#/utils/formatters/number';
import { useStore } from '#store';
import { useAccountCurrencySync } from '../useAccountCurrencySync';

const ACCOUNT = {
  id: 'user-1',
  email: 'ada@example.com',
  emailVerified: true,
  onBoarded: true,
  preferredCurrency: 'USD',
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  useStore.setState({ user: ACCOUNT, preferredCurrency: 'USD' });
});

afterEach(() => {
  jest.useRealTimers();
  useStore.setState({ user: null, preferredCurrency: DEFAULT_CURRENCY });
});

/** The settings as the server holds them; `null` is an account with no row. */
const settingsRead = (
  preferredCurrency: string | null,
  { once = false }: { once?: boolean } = {},
) => {
  const data: MockDataFor<typeof GetUserSettingsDocument> = {
    me: {
      __typename: 'User',
      id: 'user-1',
      settings: preferredCurrency
        ? { __typename: 'UserSettings', id: 'settings-1', preferredCurrency }
        : null,
    },
  };
  return recordMock(GetUserSettingsDocument, {
    data,
    ...(once && { maxUsageCount: 1 }),
  });
};

/** What a money surface reads, beside the client the resync drives. */
function useSyncedCurrency() {
  useAccountCurrencySync();
  return { currency: usePreferredCurrency(), client: useApolloClient() };
}

/** What `RefetchEventManager` runs on foreground, reconnect or a drained queue. */
const resync = (client: ReturnType<typeof useApolloClient>) =>
  drained(() => client.refetchQueries({ include: 'active' }));

describe('useAccountCurrencySync', () => {
  it('shows a currency changed on another device once the resync re-reads it', async () => {
    const before = settingsRead('GBP', { once: true });
    const after = settingsRead('EUR');
    const { result } = renderHookWithApollo(useSyncedCurrency, {
      operationMocks: [before.mock, after.mock],
    });
    await drainTimers();
    expect(result.current.currency).toBe('GBP');

    await resync(result.current.client);

    await drainTimers();
    expect(result.current.currency).toBe('EUR');
    // The persisted record follows, so the next launch opens in it too.
    expect(useStore.getState().user?.preferredCurrency).toBe('EUR');
  });

  it('takes the currency the settings hold when this device last had another', async () => {
    const read = settingsRead('GBP');
    const { result } = renderHookWithApollo(useSyncedCurrency, {
      operationMocks: [read.mock],
    });

    await drainTimers();
    expect(result.current.currency).toBe('GBP');
    expect(useStore.getState().user?.preferredCurrency).toBe('GBP');
  });

  // The region default may still apply to it; nothing here states a currency.
  it('leaves an account with no settings as it is', async () => {
    const read = settingsRead(null);
    const { result } = renderHookWithApollo(useSyncedCurrency, {
      operationMocks: [read.mock],
    });

    await drainTimers();

    expect(read.fired).toHaveLength(1);
    expect(result.current.currency).toBe('USD');
    expect(useStore.getState().user?.preferredCurrency).toBe('USD');
  });

  it('does not undo a pick still on its way to the server', async () => {
    const read = settingsRead('GBP');
    const { result } = renderHookWithApollo(useSyncedCurrency, {
      operationMocks: [read.mock],
    });
    await drainTimers();
    expect(result.current.currency).toBe('GBP');

    // `useCurrencyPreference` moves the mirror ahead of its write.
    act(() => useStore.getState().setPreferredCurrency('EUR'));
    await resync(result.current.client);

    expect(read.fired).toHaveLength(2);
    expect(result.current.currency).toBe('EUR');
  });
});
