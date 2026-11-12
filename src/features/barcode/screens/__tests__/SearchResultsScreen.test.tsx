import React from 'react';
import { screen, userEvent, within } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { isRecord } from '#/utils/isRecord';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { t } from '#/i18n';
import { ItemByLookupDocument } from '#features/barcode/hooks/useSearchResults.generated';
import { useBarcodeScannerStore } from '#features/barcode/store/barcodeScannerStore';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { ItemNotFound } from '../../components/ItemNotFound';
import { SearchResultsScreen } from '../SearchResultsScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

let log = operationLog();

const BARCODE = '051500255162';

type Lookup = MockDataFor<typeof ItemByLookupDocument>;
type FoundNode = NonNullable<
  NonNullable<
    NonNullable<NonNullable<Lookup['items']>['edges']>[number]
  >['node']
>;

const found = (node: FoundNode = {}): Lookup => ({
  items: {
    __typename: 'ItemConnection',
    edges: [
      {
        __typename: 'ItemEdge',
        cursor: 'c0',
        node: {
          __typename: 'Item',
          id: 'item-1',
          name: 'Oat Milk',
          canEdit: false,
          canSuggest: true,
          ...node,
        },
      },
    ],
  },
});

const NOTHING: Lookup = {
  items: { __typename: 'ItemConnection', edges: [] },
};

/** Answers a lookup by the code it was asked for: the barcode, else the SKU. */
const lookingUp = (
  by: 'upc' | 'sku',
  data: Lookup,
  extra: { maxUsageCount?: number } = {},
) =>
  recordMock(ItemByLookupDocument, {
    match: vars => isRecord(vars.lookup) && by in vars.lookup,
    data,
    ...extra,
  });

interface Visit {
  source?: 'pantry' | 'shoppingList' | 'storeMode';
  answers?: ReturnType<typeof recordMock>[];
}

async function openResults({ source = 'pantry', answers = [] }: Visit = {}) {
  renderWithApollo(
    <SearchResultsScreen
      route={{
        params: {
          barcode: BARCODE,
          format: 'ean-13',
          source,
          pantryId: 'pantry-1',
          shoppingListId: 'list-1',
        },
      }}
    />,
    {
      links: [log.link],
      operationMocks: answers.map(answer => answer.mock),
    },
  );
  await log.landed(ItemByLookupDocument);
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  resetSessionScopedStores();
  useBarcodeScannerStore.setState({ scannerSheetVisible: false });
  // A household with prices on: the lookup asks for prices where they apply.
  useStore.setState({
    isOnline: true,
    apiReachable: true,
    selectedHomeId: 'home-1',
    budgetAndPrices: true,
  });
});

describe('a scanned code', () => {
  it('says it is searching until the lookup answers', () => {
    renderWithApollo(
      <SearchResultsScreen
        route={{ params: { barcode: BARCODE, format: 'ean-13' } }}
      />,
      {
        operationMocks: [recordMock(ItemByLookupDocument, { held: true }).mock],
      },
    );

    expect(screen.getByLabelText(t('searchResults.searching'))).toBeTruthy();
  });

  it('shows the product found', async () => {
    await openResults({ answers: [lookingUp('upc', found())] });

    expect(screen.getByText('Oat Milk')).toBeTruthy();
  });

  it('says the code is unknown, and offers to add it', async () => {
    await openResults({
      answers: [lookingUp('upc', NOTHING), lookingUp('sku', NOTHING)],
    });
    await log.landed(ItemByLookupDocument, 2);

    // A miss opens the add sheet by itself; the add is offered on the page too.
    useBarcodeScannerStore.setState({ scannerSheetVisible: false });
    await userEvent
      .setup()
      .press(
        within(screen.UNSAFE_getByType(ItemNotFound)).getByText(
          t('labels.addItem'),
        ),
      );

    expect(useBarcodeScannerStore.getState().scannerSheetVisible).toBe(true);
  });

  it('says a lookup failed, and looks again on retry', async () => {
    await openResults({
      answers: [
        recordMock(ItemByLookupDocument, {
          error: new Error('Network request failed'),
          maxUsageCount: 1,
        }),
        lookingUp('upc', found()),
      ],
    });

    expect(screen.getByText(t('errors.searchFailed'))).toBeTruthy();
    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(ItemByLookupDocument, 2);

    expect(screen.getByText('Oat Milk')).toBeTruthy();
  });

  it('asks for prices only in store mode', async () => {
    const asked = lookingUp('upc', found());
    await openResults({ source: 'storeMode', answers: [asked] });

    expect(asked.fired[0]).toMatchObject({
      listId: 'list-1',
      withPrices: true,
    });
  });

  it('asks no prices in store mode with budget and prices off', async () => {
    useStore.setState({ budgetAndPrices: false });
    const asked = lookingUp('upc', found());
    await openResults({ source: 'storeMode', answers: [asked] });

    expect(asked.fired[0]?.withPrices).not.toBe(true);
  });

  it('asks no prices outside store mode', async () => {
    const asked = lookingUp('upc', found());
    await openResults({ source: 'shoppingList', answers: [asked] });

    expect(asked.fired[0]?.withPrices).not.toBe(true);
  });
});

describe('the found product', () => {
  it('is offered to its owner as an edit', async () => {
    await openResults({
      answers: [lookingUp('upc', found({ canEdit: true, canSuggest: false }))],
    });

    expect(
      screen.getByTestId(barcodeTestIDs.productEditActionLabel),
    ).toHaveTextContent(t('labels.edit'));
  });

  it('is offered to anyone else as a suggestion', async () => {
    await openResults({ answers: [lookingUp('upc', found())] });

    expect(
      screen.getByTestId(barcodeTestIDs.productEditActionLabel),
    ).toHaveTextContent(t('labels.suggestEdit'));
  });

  it('offers no edit to someone who may neither edit nor suggest', async () => {
    await openResults({
      answers: [lookingUp('upc', found({ canEdit: false, canSuggest: false }))],
    });

    expect(
      screen.queryByTestId(barcodeTestIDs.productEditAction),
    ).not.toBeOnTheScreen();
  });

  it('opens a new version with its details filled in', async () => {
    await openResults({ answers: [lookingUp('upc', found())] });

    await userEvent.setup().press(screen.getByText(t('barcode.newVersion')));

    expect(useBarcodeScannerStore.getState().scannerSheetVisible).toBe(true);
    expect(screen.getByDisplayValue('Oat Milk')).toBeTruthy();
  });
});

describe('the header', () => {
  it('scans another', async () => {
    await openResults({ answers: [lookingUp('upc', found())] });

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('labels.scanAnother')));

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });
});
