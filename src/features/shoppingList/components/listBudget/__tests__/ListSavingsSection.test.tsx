import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import { UnitSystem } from '#/graphql/generated/schemaTypes';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  ALDI,
  GIANT_EAGLE,
  KROGER,
  candidate,
  saving,
  savingsAnswer,
  type SavingsAnswer,
} from '#/test-utils/fixtures/listSavingsFixtures';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { ListSavingsDocument } from '#features/shoppingList/hooks/useListSavings.generated';
import { ListSavingsSection } from '../ListSavingsSection';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(),
}));
jest.mock('#hooks/settings/useReadingSystem', () => ({
  useReadingSystem: jest.fn(),
}));

const VARIABLES = { listId: 'list-1' };

const answer = savingsAnswer([
  candidate(GIANT_EAGLE, { isTarget: true, total: 60 }),
  candidate(ALDI, {
    total: 52,
    savingVsTarget: saving(8, 7),
    standIn: {
      __typename: 'PriceStandIn',
      distanceKm: 6.4,
      store: { __typename: 'Store', id: 's-aldi-w', name: 'ALDI Wilkinsburg' },
    },
  }),
  candidate(KROGER, { total: 58.8, savingVsTarget: saving(1.2, 9, true) }),
  candidate(
    { __typename: 'Store', id: 's-iga', name: 'IGA', address: null },
    {
      total: null,
    },
  ),
]);

const answering = (savings: SavingsAnswer) =>
  recordMock(ListSavingsDocument, {
    data: { shoppingListStoreSavings: savings },
  });
const failing = () =>
  recordMock(ListSavingsDocument, {
    error: new Error('Network request failed'),
  });

const cached = (savings: SavingsAnswer) => {
  const cache = makeCache();
  cache.writeQuery({
    query: ListSavingsDocument,
    variables: VARIABLES,
    data: { __typename: 'Query', shoppingListStoreSavings: savings },
  });
  return cache;
};

const renderSection = (
  mocks: ReturnType<typeof recordMock>['mock'][],
  cache = makeCache(),
) =>
  renderWithApollo(<ListSavingsSection listId="list-1" homeId="home-1" />, {
    cache,
    operationMocks: mocks,
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
  jest.mocked(useReadingSystem).mockReturnValue(UnitSystem.Imperial);
});

describe('ListSavingsSection', () => {
  it("shows each store's total and saving, with the list's store marked", async () => {
    renderSection([answering(answer).mock]);

    expect(await screen.findByText('Save about $8 on 7 items')).toBeTruthy();
    expect(screen.getByText("Your list's store")).toBeTruthy();
    expect(screen.getByText('About the same on 9 items')).toBeTruthy();
    expect(screen.getByText('$52.00')).toBeTruthy();
    expect(screen.getByText('Not enough prices yet')).toBeTruthy();
  });

  it('names where a store’s prices come from', async () => {
    renderSection([answering(answer).mock]);

    expect(
      await screen.findByText('Prices from ALDI Wilkinsburg, 4 mi away'),
    ).toBeTruthy();
  });

  it('shows the last answer when the request fails, and when it was given', async () => {
    renderSection([failing().mock], cached(answer));

    expect(await screen.findByText(/^Prices as of /)).toBeTruthy();
    expect(screen.getByText('Save about $8 on 7 items')).toBeTruthy();
  });

  it('says how old the stored prices are while offline', async () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    renderSection([], cached(answer));

    expect(await screen.findByText(/^Prices as of /)).toBeTruthy();
    expect(screen.getByText('Save about $8 on 7 items')).toBeTruthy();
    useStore.setState({ isOnline: true });
  });

  it('says comparing stores needs a connection when there is no answer', async () => {
    renderSection([failing().mock]);

    expect(
      await screen.findByText('Comparing stores needs a connection'),
    ).toBeTruthy();
  });

  it('asks for stores when the household has none to compare', async () => {
    renderSection([answering(savingsAnswer([])).mock]);

    expect(
      await screen.findByText(
        'No stores to compare yet. Add the stores you shop at.',
      ),
    ).toBeTruthy();
  });

  it('is left out with Budget & prices off, asking nothing', async () => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
    const asked = answering(answer);
    renderSection([asked.mock]);

    await waitFor(() =>
      expect(screen.queryByText('Could you save?')).toBeNull(),
    );
    expect(
      screen.queryByText('Comparing stores needs a connection'),
    ).toBeNull();
    expect(asked.fired).toHaveLength(0);
  });

  it("opens a store's items, and the household's stores", async () => {
    renderSection([answering(answer).mock]);

    fireEvent.press(await screen.findByText('ALDI Banksville'));
    expect(useAppNavigation().toStoreSavingsItems).toHaveBeenCalledWith({
      listId: 'list-1',
      storeKey: 'store:s-aldi',
    });

    fireEvent.press(screen.getByText('Your stores'));
    expect(useAppNavigation().toUsualStores).toHaveBeenCalledWith({
      homeId: 'home-1',
    });
  });
});
