import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  completeMockedResponse,
  recordMock,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { GetCurrenciesDocument } from '#features/profile/graphql/currency.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService, type AlertButton } from '#/services/alertService';
import { DEFAULT_CURRENCY } from '#/utils/formatters/number';
import { useStore } from '#store';
import { t } from '#/i18n';
import { useCurrencyPreference } from '../useCurrencyPreference';

const ACCOUNT = {
  id: 'user-1',
  email: 'ada@example.com',
  emailVerified: true,
  onBoarded: true,
  preferredCurrency: 'USD',
};

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ user: ACCOUNT, preferredCurrency: 'USD' });
});

afterEach(() => {
  useStore.setState({ user: null, preferredCurrency: DEFAULT_CURRENCY });
});

type UpdateData = MockDataFor<typeof UpdateUserPreferencesDocument>;

const CURRENCIES: MockDataFor<typeof GetCurrenciesDocument> = {
  currencies: [
    {
      __typename: 'Currency',
      id: 'c-usd',
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
    },
    {
      __typename: 'Currency',
      id: 'c-eur',
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
    },
  ],
};

const APPLIED: UpdateData = {
  updateSettings: {
    __typename: 'UpdateSettingsPayload',
    userSettings: {
      __typename: 'UserSettings',
      id: 'settings-1',
      preferredCurrency: 'EUR',
    },
  },
};

const REFUSED: UpdateData = {
  updateSettings: {
    __typename: 'ValidationError',
    code: ErrorCode.ValidationFailed,
    message: 'Unknown currency',
    field: 'regional.preferredCurrency',
  },
};

/** How the server answers the settings write: its data, or a transport error. */
type UpdateOutcome = { data: UpdateData } | { error: Error };

interface SentWrite {
  context: Record<string, unknown>;
  variables: Record<string, unknown>;
}

/**
 * Renders the hook over the real store and a real link chain: a leading tap
 * link records the `context` and `variables` each settings write was sent
 * with, then forwards to a `MockLink` serving the supplied responses.
 */
function renderCurrency(outcome: UpdateOutcome) {
  const sent: SentWrite[] = [];
  const tapLink = new ApolloLink((operation, forward) => {
    if (
      operation.operationName === operationNameOf(UpdateUserPreferencesDocument)
    ) {
      sent.push({
        context: operation.getContext(),
        variables: operation.variables,
      });
    }
    return forward(operation);
  });
  const mocks = [
    recordMock(GetCurrenciesDocument, { data: CURRENCIES }).mock,
    recordMock(UpdateUserPreferencesDocument, outcome).mock,
  ];
  const client = new ApolloClient({
    cache: makeCache(),
    link: ApolloLink.from([
      tapLink,
      new MockLink(mocks.map(completeMockedResponse)),
    ]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );
  const rendered = renderHook(() => useCurrencyPreference(), { wrapper });
  return { ...rendered, sent };
}

/** Confirms the "costs keep their currency" prompt the pick opened. */
function confirmPick() {
  const [title, body, buttons] = (alertService.alert as jest.Mock).mock
    .calls[0] as [string, string, AlertButton[]];
  expect(title).toBe(t('labels.currency'));
  expect(body).toBe(t('settings.currencyKeepsExisting'));
  const confirm = buttons.find(button => button.text === t('labels.confirm'));
  confirm?.onPress?.();
}

const mirror = () => useStore.getState().preferredCurrency;
const record = () => useStore.getState().user?.preferredCurrency;

/** The slice a relaunch restores, as it is written: through JSON. */
const persisted = (): { preferredCurrency?: string; user?: typeof ACCOUNT } => {
  const { partialize } = useStore.persist.getOptions();
  return JSON.parse(JSON.stringify(partialize!(useStore.getState())));
};

describe('useCurrencyPreference', () => {
  it('offers the active currencies and labels the one the account holds', async () => {
    const { result } = renderCurrency({ data: APPLIED });

    await waitFor(() => expect(result.current.options).toHaveLength(2));

    expect(result.current.preferredCurrency).toBe('USD');
    expect(result.current.currentLabel).toBe('USD ($)');
    expect(result.current.options).toEqual([
      { value: 'USD', label: 'USD — US Dollar ($)' },
      { value: 'EUR', label: 'EUR — Euro (€)' },
    ]);
  });

  it('asks nothing and sends nothing when the pick is the current currency', () => {
    const { result, sent } = renderCurrency({ data: APPLIED });

    act(() => result.current.selectCurrency('USD'));

    expect(alertService.alert).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('sends nothing until the pick is confirmed', () => {
    const { result, sent } = renderCurrency({ data: APPLIED });

    act(() => result.current.selectCurrency('EUR'));

    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
    expect(mirror()).toBe('USD');
  });

  it('writes the pick to the settings, and a saved pick reaches the record a relaunch restores', async () => {
    const { result, sent } = renderCurrency({ data: APPLIED });

    act(() => result.current.selectCurrency('EUR'));
    act(() => {
      confirmPick();
      // Ahead of the round trip: the money on screen re-denominates at once,
      // while the record waits for the write to be known to have landed.
      expect(mirror()).toBe('EUR');
      expect(record()).toBe('USD');
    });

    await waitFor(() => expect(record()).toBe('EUR'));

    // The settings' own currency, sent as is: never `localFirst`, so it is
    // never queued behind money shown in a currency the account lacks.
    expect(sent).toHaveLength(1);
    expect(sent[0]?.variables).toEqual({
      input: { regional: { preferredCurrency: 'EUR' } },
    });
    expect(sent[0]?.context.localFirst).toBeUndefined();

    expect(mirror()).toBe('EUR');
    expect(result.current.preferredCurrency).toBe('EUR');
    // Picked, saved, then relaunched: the record carries the pick, and the
    // record is what rehydration puts back over the mirror.
    expect(persisted().user?.preferredCurrency).toBe('EUR');
    expect(persisted().preferredCurrency).toBe('EUR');
    // Only the confirmation prompt: a saved pick raises no alert of its own.
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });

  it('restores the mirror and leaves the record alone when the server refuses the pick', async () => {
    const { result, sent } = renderCurrency({ data: REFUSED });

    act(() => result.current.selectCurrency('EUR'));
    act(() => confirmPick());

    // The refusal is reported: the prompt, then the failure.
    await waitFor(() => expect(alertService.alert).toHaveBeenCalledTimes(2));

    expect(sent).toHaveLength(1);
    expect(mirror()).toBe('USD');
    expect(record()).toBe('USD');
    expect(result.current.preferredCurrency).toBe('USD');
    expect(persisted().user?.preferredCurrency).toBe('USD');
  });

  it('restores the mirror and leaves the record alone when the write cannot be sent', async () => {
    const { result, sent } = renderCurrency({
      error: new Error('Network request failed'),
    });

    act(() => result.current.selectCurrency('EUR'));
    act(() => confirmPick());

    await waitFor(() => expect(alertService.alert).toHaveBeenCalledTimes(2));

    expect(sent).toHaveLength(1);
    expect(mirror()).toBe('USD');
    expect(record()).toBe('USD');
    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.error'),
      t('settings.updateFailed'),
    );
  });
});
