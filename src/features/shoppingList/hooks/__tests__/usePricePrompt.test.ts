import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import { drainTimers } from '#/test-utils/drainTimers';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { writeUserSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import { alertService } from '#/services/alertService';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useStore } from '#store';
import { MIRRORED_SETTINGS } from '#/domain/serverSettings';
import type { AlertButton } from '#platform/presenters';
import { usePricePrompt } from '../usePricePrompt';
import { PricePromptReadinessDocument } from '../usePricePrompt.generated';

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));

const USER = {
  id: 'user-1',
  email: 'john@example.com',
  emailVerified: true,
  onBoarded: true,
};

/** The device after a settings read, with the server's answer on readiness. */
const given = async ({
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
  const cache = makeCache();
  if (settingsRead) {
    writeUserSettings(cache, { budgetAndPrices: answer });
  }
  const write = recordMock(UpdateUserPreferencesDocument, {
    data: { updateSettings: null },
  });
  const read = recordMock(PricePromptReadinessDocument, {
    data: {
      shoppingList: {
        __typename: 'ShoppingList',
        id: 'list-1',
        version: 1,
        priceReadiness: readiness && {
          __typename: 'PriceReadiness',
          ...readiness,
        },
      },
    },
  });
  const rendered = renderHookWithApollo(() => usePricePrompt(), {
    cache,
    operationMocks: [write.mock, read.mock],
  });
  await drainTimers();
  return { write, read, rendered };
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

  it('asks once price data is enough and the account never answered', async () => {
    await given();

    expect(asked()).toHaveLength(1);
    expect(asked()[0]![0]).toBe('Show prices and savings?');
  });

  it('asks once, however often the list is read again', async () => {
    const { rendered } = await given();
    rendered.rerender({});
    await drainTimers();

    expect(asked()).toHaveLength(1);
  });

  it('does not ask before price data is enough', async () => {
    await given({ readiness: { enough: false } });

    expect(asked()).toHaveLength(0);
  });

  // "Not now" is final, on this device or another; so is a hand switch.
  it('never asks an account that answered either way', async () => {
    await given({ answer: false });
    await given({ answer: true });

    expect(asked()).toHaveLength(0);
  });

  // Readiness costs the API about ten reads, so it is not asked for in vain.
  it('reads no readiness once the account answered', async () => {
    const { read } = await given({ answer: false });

    expect(read.fired).toEqual([]);
  });

  it('never asks a share-code reader, who has no readiness', async () => {
    await given({ readiness: null });

    expect(asked()).toHaveLength(0);
  });

  // The mirror's null is a default until the account's answer is read.
  it('waits for the account settings before asking', async () => {
    await given({ settingsRead: false });

    expect(asked()).toHaveLength(0);
  });

  it('does nothing where the build withholds prices', async () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    await given();

    expect(asked()).toHaveLength(0);
  });

  it('turns prices on with a yes', async () => {
    const { write } = await given();

    press('Show prices');

    expect(useStore.getState().budgetAndPrices).toBe(true);
    await drainTimers();
    expect(write.fired).toEqual([
      { input: { shopping: { budgetAndPrices: true } } },
    ]);
  });

  it('keeps prices off with "Not now", for good', async () => {
    const { write } = await given();

    press('Not now');

    expect(useStore.getState().budgetAndPrices).toBe(false);
    await drainTimers();
    expect(write.fired).toEqual([
      { input: { shopping: { budgetAndPrices: false } } },
    ]);
  });
});
