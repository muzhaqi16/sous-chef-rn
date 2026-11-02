import { ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { act, renderHook } from '@testing-library/react-native';
import type { DocumentNode } from 'graphql';
import { createElement, type ReactNode } from 'react';
import { Subject } from 'rxjs';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { createRefetchEventManager } from '#/apollo/refetchEvents';
import {
  completeMockedResponse,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { useSettingsMirror } from '#bootstrap/useSettingsMirror';
import { useAccountCurrencySync } from '#features/profile/hooks/useAccountCurrencySync';
import { useAppSettings } from '#features/profile/hooks/useAppSettings';
import { useBudgetAndPricesCarryOver } from '#features/profile/hooks/useBudgetAndPricesCarryOver';
import { useCurrencyPreference } from '#features/profile/hooks/useCurrencyPreference';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { GetCurrenciesDocument } from '#features/profile/graphql/currency.generated';

/**
 * Settings and currencies are read app-wide: a reader mounting later adds no
 * request, and a resync still refreshes them. On a real client and manager,
 * since a resync is what keeps a `cache-first` read fresh.
 */

const USER = {
  id: 'user-1',
  email: 'test@souschef.dev',
  emailVerified: true,
  onBoarded: true,
};

/** Each operation's requests, and a promise of the nth, which needs no clock. */
function requestLog() {
  const seen = new Map<string, number>();
  const waiting = new Set<() => void>();
  const counting = new ApolloLink((operation, forward) => {
    const name = operation.operationName ?? '';
    seen.set(name, (seen.get(name) ?? 0) + 1);
    waiting.forEach(check => {
      check();
    });
    return forward(operation);
  });
  const asked = (document: DocumentNode, times: number) =>
    new Promise<void>(resolve => {
      const check = () => {
        if ((seen.get(operationNameOf(document)) ?? 0) < times) return;
        waiting.delete(check);
        resolve();
      };
      waiting.add(check);
      check();
    });
  return { counting, asked };
}

function setup() {
  const foreground = new Subject<void>();
  const { counting, asked } = requestLog();
  const manager = createRefetchEventManager();
  const settings = recordMock(GetUserSettingsDocument, {
    data: { me: { __typename: 'User', id: USER.id } },
  });
  const currencies = recordMock(GetCurrenciesDocument, {
    data: { currencies: [] },
  });
  const client = new ApolloClient({
    cache: makeCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    dataMasking: true,
    link: ApolloLink.from([
      counting,
      new MockLink(
        [settings, currencies].map(({ mock }) => completeMockedResponse(mock)),
      ),
    ]),
    refetchEventManager: manager,
  });
  manager.setEventSource('appForeground', () => foreground);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ApolloProvider, { client, children });
  const mount = <T,>(hook: () => T) => renderHook(hook, { wrapper });
  return { client, foreground, settings, currencies, asked, mount };
}

const useSessionReaders = () => {
  useSettingsMirror();
  useBudgetAndPricesCarryOver();
  useAccountCurrencySync();
};

beforeEach(() => {
  useStore.setState({ user: USER, isOnline: true, apiReachable: true });
});

it('asks for settings once however many readers mount, and whenever', async () => {
  const { client, settings, mount } = setup();

  mount(useSessionReaders);
  await act(() => client.query({ query: GetUserSettingsDocument }));
  expect(settings.fired).toHaveLength(1);

  const screen = mount(useAppSettings);

  expect(screen.result.current.loading).toBe(false);
  expect(settings.fired).toHaveLength(1);
});

it('asks for currencies once across visits to the screen', async () => {
  const { client, currencies, mount } = setup();

  const first = mount(useCurrencyPreference);
  await act(() => client.query({ query: GetCurrenciesDocument }));
  first.unmount();

  mount(useCurrencyPreference);

  expect(currencies.fired).toHaveLength(1);
});

it('still refreshes on a resync', async () => {
  const { client, foreground, asked, mount } = setup();
  mount(useSessionReaders);
  mount(useCurrencyPreference);
  await act(() =>
    Promise.all([
      client.query({ query: GetUserSettingsDocument }),
      client.query({ query: GetCurrenciesDocument }),
    ]),
  );

  foreground.next();

  await act(() =>
    Promise.all([
      asked(GetUserSettingsDocument, 2),
      asked(GetCurrenciesDocument, 2),
    ]),
  );
});
