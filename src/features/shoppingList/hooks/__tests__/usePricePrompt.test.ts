import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { writeUserSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import { alertService } from '#/services/alertService';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useStore } from '#store';
import { MIRRORED_SETTINGS } from '#/domain/serverSettings';
import type { AlertButton } from '#platform/presenters';
import { usePricePrompt } from '../usePricePrompt';

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));

const USER = {
  id: 'user-1',
  email: 'john@example.com',
  emailVerified: true,
  onBoarded: true,
};

const list = (priceReadiness: { enough: boolean } | null) => ({
  __typename: 'ShoppingList',
  id: 'list-1',
  version: 1,
  priceReadiness: priceReadiness && {
    __typename: 'PriceReadiness',
    ...priceReadiness,
  },
});

/** The device after a settings read and a list read. */
const given = ({
  answer = null,
  readiness = { enough: true },
  settingsRead = true,
}: {
  answer?: boolean | null;
  readiness?: { enough: boolean } | null;
  settingsRead?: boolean;
} = {}) => {
  useStore.setState({ user: USER, selectedShoppingListId: 'list-1' });
  useStore.getState().mirrorSettings({ budgetAndPrices: answer });
  const cache = seedCache([list(readiness)]);
  if (settingsRead) {
    writeUserSettings(cache, { budgetAndPrices: answer });
  }
  const write = recordMock(UpdateUserPreferencesDocument, {
    data: { updateSettings: null },
  });
  const rendered = renderHookWithApollo(() => usePricePrompt(), {
    cache,
    operationMocks: [write.mock],
  });
  return { write, rendered };
};

const asked = () => jest.mocked(alertService.alert).mock.calls;
const press = (label: string) => {
  const [, , buttons] = asked()[0]!;
  const button = (buttons as AlertButton[]).find(b => b.text === label);
  act(() => button?.onPress?.());
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePricePrompt', () => {
  beforeEach(() => {
    jest.mocked(alertService.alert).mockClear();
    jest.mocked(useFeatureFlag).mockReturnValue(true);
  });

  afterEach(() => {
    useStore.setState({ user: null, selectedShoppingListId: null });
    useStore.getState().mirrorSettings(MIRRORED_SETTINGS);
  });

  it('asks once price data is enough and the account never answered', () => {
    given();

    expect(asked()).toHaveLength(1);
    expect(asked()[0]![0]).toBe('Show prices and savings?');
  });

  it('asks once, however often the list is read again', () => {
    const { rendered } = given();
    rendered.rerender({});

    expect(asked()).toHaveLength(1);
  });

  it('does not ask before price data is enough', () => {
    given({ readiness: { enough: false } });

    expect(asked()).toHaveLength(0);
  });

  // "Not now" is final, on this device or another; so is a hand switch.
  it('never asks an account that answered either way', () => {
    given({ answer: false });
    given({ answer: true });

    expect(asked()).toHaveLength(0);
  });

  it('never asks a share-code reader, who has no readiness', () => {
    given({ readiness: null });

    expect(asked()).toHaveLength(0);
  });

  // The mirror's null is a default until the account's answer is read.
  it('waits for the account settings before asking', () => {
    given({ settingsRead: false });

    expect(asked()).toHaveLength(0);
  });

  it('does nothing where the build withholds prices', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    given();

    expect(asked()).toHaveLength(0);
  });

  it('turns prices on with a yes', async () => {
    const { write } = given();

    press('Show prices');

    expect(useStore.getState().budgetAndPrices).toBe(true);
    await drainTimers();
    expect(write.fired).toEqual([
      { input: { shopping: { budgetAndPrices: true } } },
    ]);
  });

  it('keeps prices off with "Not now", for good', async () => {
    const { write } = given();

    press('Not now');

    expect(useStore.getState().budgetAndPrices).toBe(false);
    await drainTimers();
    expect(write.fired).toEqual([
      { input: { shopping: { budgetAndPrices: false } } },
    ]);
  });
});
