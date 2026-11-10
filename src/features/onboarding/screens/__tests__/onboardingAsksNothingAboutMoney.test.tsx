import React from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { useStore } from '#store';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';
import { OnboardingCompleteScreen } from '../OnboardingCompleteScreen';
import { HouseholdStepScreen } from '../HouseholdStepScreen';
import { DietaryStepScreen } from '../DietaryStepScreen';
import { ReceiptStepScreen } from '../ReceiptStepScreen';

jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#/services/device/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));
jest.mock('#features/notifications/screens/useNotificationPermissions', () => ({
  useNotificationPermissions: () => ({
    hasPermission: false,
    requestPermissions: jest.fn(() => Promise.resolve(true)),
    checkPermissions: jest.fn(),
  }),
}));

const NEW_ACCOUNT = {
  id: 'user-1',
  email: 'new@example.com',
  emailVerified: true,
  onBoarded: false,
};

const usualStore = (id: string, name: string, addedVia: UsualStoreSource) => ({
  __typename: 'UsualStore',
  id: `home-1:${id}`,
  addedVia,
  store: { __typename: 'Store', id, name, address: null, chain: null },
  chain: null,
});

// A receipt's store, and one picked from the store card.
const STORES = [
  usualStore('s-ge', 'Giant Eagle', UsualStoreSource.Receipt),
  usualStore('s-aldi', 'ALDI', UsualStoreSource.Picked),
];

/** The settings and completion finishing sends, as the server received them. */
const renderFinishing = (stores: object[]) => {
  const sent = { settings: [] as object[], notifications: 0, completed: 0 };
  let completed = () => {};
  // Settings are written before completion is sent, so all is in by then.
  const finished = new Promise<void>(resolve => {
    completed = resolve;
  });
  const { client } = renderWithApollo(<OnboardingCompleteScreen />, {
    resolvers: () => ({
      Query: { usualStores: () => stores },
      Mutation: {
        updateSettings: (_root: unknown, args: { input: object }) => {
          sent.settings.push(args.input);
          return { __typename: 'UpdateSettingsPayload' };
        },
        updateNotificationPreferences: () => {
          sent.notifications += 1;
          return { __typename: 'UpdateNotificationPreferencesPayload' };
        },
        completeOnboarding: () => {
          sent.completed += 1;
          completed();
          return { __typename: 'CompleteOnboardingPayload' };
        },
      },
    }),
  });
  return {
    sent,
    /** The store card's read, joined: its answer has rendered once this resolves. */
    storesRead: () =>
      act(async () => {
        await client.query({
          query: UsualStoresDocument,
          variables: { homeId: 'home-1' },
        });
      }),
    finishing: () =>
      act(async () => {
        await finished;
      }),
  };
};

const MONEY = /price|budget|estimat|cost|spend/i;

beforeEach(() => {
  useStore.setState({ user: NEW_ACCOUNT, selectedHomeId: 'home-1' });
  jest.spyOn(alertService, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  useStore.setState({ user: null, selectedHomeId: null });
});

describe('Onboarding asks nothing about money and needs no store', () => {
  it.each([
    ['household', HouseholdStepScreen, 'onBoarding.householdTitle'],
    ['dietary', DietaryStepScreen, 'onBoarding.dietaryTitle'],
    ['receipt', ReceiptStepScreen, 'onBoarding.receiptTitle'],
  ] as const)(
    'asks nothing about money on the %s step',
    async (_step, Step, title) => {
      const { client } = renderWithApollo(<Step />, { resolvers: () => ({}) });

      // Every read the step makes has answered and rendered once this resolves.
      await act(async () => {
        await client.refetchQueries({ include: 'active' });
      });

      expect(screen.getByText(t(title))).toBeTruthy();
      expect(screen.queryAllByText(MONEY)).toEqual([]);
      expect(screen.queryAllByLabelText(MONEY)).toEqual([]);
    },
  );

  const NAMED = () =>
    t('onBoarding.yourStores', { names: 'Giant Eagle, ALDI' });

  it.each([
    ['without stores', [], () => t('onBoarding.addStores')],
    ['with stores added', STORES, NAMED],
  ])(
    'shows no price, budget or estimate %s',
    async (_case, stores, settled) => {
      const { storesRead } = renderFinishing(stores);

      await storesRead();

      expect(screen.getByText(settled())).toBeTruthy();
      expect(screen.queryAllByText(MONEY)).toEqual([]);
      expect(screen.queryAllByLabelText(MONEY)).toEqual([]);
    },
  );

  it('finishes with stores added, sending no shopping or notification settings', async () => {
    const user = userEvent.setup();
    const { sent, storesRead, finishing } = renderFinishing(STORES);
    await storesRead();
    expect(screen.getByText(NAMED())).toBeTruthy();

    await user.press(screen.getByText(t('labels.getStarted')));

    await finishing();
    expect(sent.completed).toBe(1);
    expect(sent.notifications).toBe(0);
    expect(sent.settings).not.toContainEqual(
      expect.objectContaining({ shopping: expect.anything() }),
    );
  });
});
