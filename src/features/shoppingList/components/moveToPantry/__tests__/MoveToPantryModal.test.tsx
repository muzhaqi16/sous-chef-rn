import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ViewProps } from 'react-native';
import { MoveToPantryModal } from '#features/shoppingList/components/moveToPantry/MoveToPantryModal';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import {
  renderWithApollo,
  seedCache,
  type MockFor,
  type QueryDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  MoveToPantryModal_ShoppingListItemFragmentDoc,
  MoveToPantryPurchaseInfoDocument,
} from '#features/shoppingList/components/moveToPantry/MoveToPantryModal.generated';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007AFF',
        surface: '#FFF',
        surfaceVariant: '#F5F5F5',
        border: '#CCC',
        white: '#FFF',
        error: '#FF0000',
        background: '#FFF',
      },
      spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24 },
    },
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/BottomSheetFormScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetFormScrollView: (props: ViewProps) =>
      require('react').createElement(RN.View, props),
  };
});

jest.mock('#components/organisms/Header', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    // Actions are rendered, not just the title: the confirm tap is the only way
    // to observe what the sheet sends.
    Header: ({
      title,
      rightActions = [],
    }: {
      title: string;
      rightActions?: Array<{ icon: string; onPress: () => void }>;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, title),
        ...rightActions.map((action, index) =>
          R.createElement(
            RN.Text,
            {
              key: index,
              testID: `header-action-${action.icon}`,
              onPress: action.onPress,
            },
            action.icon,
          ),
        ),
      ),
  };
});

jest.mock('#components/molecules/FractionInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FractionInput: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value?: string;
      onChangeText?: (text: string) => void;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          testID: 'move-to-pantry-quantity',
          value,
          onChangeText,
        }),
      ),
  };
});

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    // Reproduces the real field's order — the symbol first, then the id, and a
    // keystroke drops a previous pick. The required-unit rule reports on the
    // TEXT while reading the id, so only both writes together exercise it.
    // A field with a `testID` prefixes its controls with it.
    UnitAutocompleteField: ({
      value,
      onChangeText,
      onUnitSelected,
      error,
      testID,
    }: {
      value?: string;
      onChangeText: (text: string) => void;
      onUnitSelected?: (
        unitId: string | null,
        name?: string,
        type?: string,
      ) => void;
      error?: string;
      testID?: string;
    }) => {
      const prefix = testID ? `${testID}-` : '';
      return R.createElement(
        RN.View,
        { testID: `${prefix}unit-autocomplete` },
        // Typing, as the real field does it: the text, then the pick dropped.
        R.createElement(RN.TextInput, {
          testID: `${prefix}unit-input`,
          value,
          onChangeText: (text: string) => {
            onChangeText(text);
            onUnitSelected?.(null);
          },
        }),
        R.createElement(
          RN.Pressable,
          {
            testID: `${prefix}pick-unit`,
            onPress: () => {
              onChangeText('kg');
              onUnitSelected?.('unit-kg');
            },
          },
          R.createElement(RN.Text, null, 'Pick kg'),
        ),
        R.createElement(
          RN.Pressable,
          {
            testID: `${prefix}pick-gal`,
            onPress: () => {
              onChangeText('gal');
              onUnitSelected?.('u1', 'gallon', 'VOLUME');
            },
          },
          R.createElement(RN.Text, null, 'Pick gal'),
        ),
        R.createElement(
          RN.Pressable,
          {
            testID: `${prefix}pick-box`,
            onPress: () => {
              onChangeText('box');
              onUnitSelected?.('unit-box', 'box', 'COUNT');
            },
          },
          R.createElement(RN.Text, null, 'Pick box'),
        ),
        R.createElement(
          RN.Pressable,
          {
            testID: `${prefix}clear-unit`,
            onPress: () => {
              onChangeText('');
              onUnitSelected?.(null);
            },
          },
          R.createElement(RN.Text, null, 'Clear'),
        ),
        error
          ? R.createElement(RN.Text, { testID: `${prefix}unit-error` }, error)
          : null,
      );
    },
  };
});

jest.mock('#components/atoms/FormInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FormInput: ({
      label,
      value,
      onChangeText,
      placeholder,
      error,
    }: {
      label: string;
      value?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      error?: string;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          testID: `move-to-pantry-field-${label}`,
          value,
          onChangeText,
          placeholder,
        }),
        error ? R.createElement(RN.Text, null, error) : null,
      ),
  };
});

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

const ITEM_ID = 'sli-1';
const SIZE_UNIT = shoppingListTestIDs.moveToPantryPackageSizeUnit;

function makeCache(overrides: Record<string, unknown> = {}) {
  return seedCache([
    {
      // The production selection the consumer reads, so a thin fixture fails
      // here instead of defining its own idea of complete.
      fragment: MoveToPantryModal_ShoppingListItemFragmentDoc,
      data: {
        __typename: 'ShoppingListItem',
        version: 1,
        id: ITEM_ID,
        itemName: 'Milk',
        quantity: 2,
        unitName: 'gal',
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'u1',
          symbol: 'gal',
          name: 'Gallons',
          type: UnitType.Volume,
        }),
        ...overrides,
      },
    },
  ]);
}

const defaultProps = {
  visible: true,
  shoppingListItemId: ITEM_ID,
  pantries: [
    { id: 'p1', name: 'Kitchen Pantry', isDefault: true },
    { id: 'p2', name: 'Garage', isDefault: false },
  ],
  selectedPantryId: 'p1',
  onClose: jest.fn(),
  onConfirm: jest.fn().mockResolvedValue(true),
};

const renderSheet = (
  props: Partial<React.ComponentProps<typeof MoveToPantryModal>> = {},
  line: Record<string, unknown> = {},
) =>
  renderWithApollo(<MoveToPantryModal {...defaultProps} {...props} />, {
    cache: makeCache(line),
  });

const confirm = () =>
  fireEvent.press(screen.getByTestId('header-action-checkmark'));
const typeQuantity = (text: string) =>
  fireEvent.changeText(screen.getByTestId('move-to-pantry-quantity'), text);
const quantity = () =>
  screen.getByTestId('move-to-pantry-quantity').props.value;
const totalPaid = () =>
  screen.getByTestId('move-to-pantry-field-Total paid').props.value;
const packageSize = () =>
  screen.getByTestId('move-to-pantry-field-Package size').props.value;

/** Types one package's size, then picks its unit (`kg`, `box`) or types one. */
function typeSize(size: string, unit?: 'kg' | 'box' | { typed: string }) {
  fireEvent.changeText(
    screen.getByTestId('move-to-pantry-field-Package size'),
    size,
  );
  if (unit === undefined) return;
  if (typeof unit === 'object') {
    fireEvent.changeText(
      screen.getByTestId(`${SIZE_UNIT}-unit-input`),
      unit.typed,
    );
    return;
  }
  fireEvent.press(
    screen.getByTestId(
      `${SIZE_UNIT}-${unit === 'kg' ? 'pick-unit' : 'pick-box'}`,
    ),
  );
}

describe('MoveToPantryModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('a confirm the schema refuses', () => {
    // `logValidationErrors` only writes to the log, and none of the three
    // fixable fields rendered `fieldState.error` — so a refused confirm was a
    // button that did nothing, with nothing on screen saying which field.
    it('names the field on the field rather than doing nothing', async () => {
      renderSheet();

      // The form's own `pantryId` starts null whatever the screen preselected,
      // so a bare confirm is refused on a field the user can fix.
      confirm();

      expect(await screen.findByText('Please select a pantry')).toBeTruthy();
      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });
  });

  it('reports an emptied unit field, not only on confirm', async () => {
    // The rule reports on the TEXT while reading the id, and the field writes
    // the text before dropping the id — so the write that empties the field
    // leaves nothing to re-run it.
    renderSheet();

    fireEvent.press(screen.getByTestId('pick-unit'));
    fireEvent.press(screen.getByTestId('clear-unit'));

    expect(await screen.findByTestId('unit-error')).toBeTruthy();
  });

  it.each([
    ['the Move to Pantry title', ['Move to Pantry']],
    ['the item name', ['Milk']],
    ['the pantry options', ['Kitchen Pantry', 'Garage']],
    ['a Default badge on the default pantry', ['Default']],
    ['the Quantity input', ['Quantity']],
    ['the Storage Type section', ['Storage Type']],
    ['every storage state', ['Ambient', 'Refrigerated', 'Frozen']],
    ['the Expiration Date section', ['Expiration Date']],
    ['Select date while no expiration date is set', ['Select date']],
    ['the Remove from shopping list toggle', ['Remove from shopping list']],
    ['the notes input', ['Notes (Optional)']],
    // The same question Mark Purchased asks.
    ['the total paid question', ['Total paid']],
    ['the shopping list quantity with its unit', [/Shopping list quantity: 2/]],
  ])('renders %s', (_what, texts) => {
    renderSheet();
    for (const text of texts) expect(screen.getByText(text)).toBeTruthy();
  });

  it('does not render item info when shoppingListItemId is null', () => {
    renderSheet({ shoppingListItemId: null });
    expect(screen.queryByText('Milk')).toBeNull();
  });

  it('uses unitName when unit.symbol is missing', () => {
    renderSheet({}, { unit: null, unitName: 'gallons' });
    expect(screen.getByText(/Shopping list quantity/)).toBeTruthy();
  });

  it('shows quantity as 1 when no quantity is set', () => {
    renderSheet({}, { quantity: null });
    expect(screen.getByText(/Shopping list quantity: 1/)).toBeTruthy();
  });

  describe('seeding from the recorded purchase', () => {
    interface Purchase {
      quantity?: number | null;
      price?: number | null;
      /** The unit the purchase was recorded in. */
      unit?: { symbol: string; type: UnitType };
    }

    // A line requested as 2 but BOUGHT as 5 for $2.95 the whole lot. Complete,
    // because a warm cache writes it as is.
    const purchaseData = ({
      quantity: purchasedQuantity = 5,
      price: purchasedPrice = 0.59,
      unit = { symbol: 'lb', type: UnitType.Weight },
    }: Purchase): QueryDataFor<typeof MoveToPantryPurchaseInfoDocument> => ({
      __typename: 'Query',
      shoppingListItem: {
        __typename: 'ShoppingListItem',
        version: 1,
        id: ITEM_ID,
        purchasesConnection: {
          __typename: 'PurchaseConnection',
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          edges: [
            {
              __typename: 'PurchaseEdge',
              node: {
                __typename: 'Purchase',
                version: 1,
                id: 'pu1',
                unitSymbol: unit.symbol,
                unit: { __typename: 'Unit', id: 'u-purchase', type: unit.type },
              },
            },
          ],
        },
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: true,
          movedToPantryAt: null,
          purchasedQuantity,
          purchasedPrice,
          purchaseDate: '2026-08-30T00:00:00Z',
          purchasedBy: null,
        },
      },
    });

    const NEEDS_COUNT =
      'A package size goes with a whole number of packages in a counted unit, like 2 jars. Leave it empty for an amount like 500 g.';
    const JAR_LINE = {
      unitName: 'jar',
      unit: asAbbreviation({
        __typename: 'Unit',
        id: 'u-jar',
        symbol: 'jar',
        name: 'Jars',
        type: UnitType.Count,
      }),
    };
    const NO_UNIT_LINE = { unit: null, unitName: null };

    interface OpenWithPurchase extends Purchase {
      /** Overrides on the line being moved. */
      line?: Record<string, unknown>;
      /** The purchase is already cached when the sheet opens. */
      warm?: boolean;
      onConfirm?: jest.Mock;
      onClose?: jest.Mock;
      /** What the seeded sheet's header reads; awaited before returning. */
      header?: string;
      askPrice?: boolean;
    }

    // Mounted closed, then opened: the seed runs on the closed -> open
    // transition, which is the lifecycle the sheet actually sees.
    async function openWithPurchase({
      line,
      warm = false,
      onConfirm = jest.fn().mockResolvedValue(true),
      onClose = jest.fn(),
      header = 'Purchased: 5 gal',
      askPrice,
      ...purchase
    }: OpenWithPurchase = {}) {
      const cache = makeCache(line);
      const variables = { id: ITEM_ID };
      if (warm) {
        cache.writeQuery({
          query: MoveToPantryPurchaseInfoDocument,
          variables,
          data: purchaseData(purchase),
        });
      }
      const mock: MockFor<typeof MoveToPantryPurchaseInfoDocument> = {
        request: { query: MoveToPantryPurchaseInfoDocument, variables },
        result: { data: purchaseData(purchase) },
      };
      const props = { ...defaultProps, onConfirm, onClose, askPrice };
      const { rerender } = renderWithApollo(
        <MoveToPantryModal {...props} visible={false} />,
        { cache, operationMocks: [mock] },
      );
      rerender(<MoveToPantryModal {...props} />);
      await screen.findByText(header);
      const reopen = () => {
        rerender(<MoveToPantryModal {...props} visible={false} />);
        rerender(<MoveToPantryModal {...props} />);
      };
      return { onConfirm, onClose, reopen };
    }

    it('prefills the amounts that were bought, not the ones requested', async () => {
      await openWithPurchase();

      expect(quantity()).toBe('5');
      // The field shows the TOTAL; the API stores the $0.59 per unit.
      expect(totalPaid()).toBe('2.95');
    });

    it('prefills a fractional purchased quantity as a cooking fraction', async () => {
      await openWithPurchase({
        quantity: 1.25,
        price: 2,
        header: 'Purchased: 1 1/4 gal',
      });

      expect(quantity()).toBe('1 1/4');
    });

    it('rounds a purchased quantity no fraction fits to three decimals', async () => {
      await openWithPurchase({
        quantity: 177.4412,
        price: null,
        header: 'Purchased: 177.441 gal',
      });

      expect(quantity()).toBe('177.441');
    });

    it('sends the total paid, which the server records exactly', async () => {
      const { onConfirm } = await openWithPurchase();

      confirm();

      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      const sent = onConfirm.mock.calls[0][0];
      expect(sent.amount).toEqual({ measured: { quantity: 5, unitId: 'u1' } });
      // The total as shown; the server derives the unit price, never the client.
      expect(sent.totalCost).toBeCloseTo(2.95, 10);
      expect(sent).not.toHaveProperty('actualPrice');
    });

    // Prices off, or a list that doesn't track them: nothing asks or sends one.
    it('asks for no amount paid, and sends none, when the list asks no price', async () => {
      const { onConfirm } = await openWithPurchase({ askPrice: false });

      expect(
        screen.queryByTestId('move-to-pantry-field-Total paid'),
      ).toBeNull();
      confirm();

      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      expect(onConfirm.mock.calls[0][0].totalCost).toBeUndefined();
    });

    describe('a total paid that is no amount', () => {
      const INVALID_PAID =
        'Enter the amount paid, like 3.49, or leave it empty.';
      const typeTotal = (text: string) =>
        fireEvent.changeText(
          screen.getByTestId('move-to-pantry-field-Total paid'),
          text,
        );

      // It was dropped without a word, or sent below zero.
      it.each(['-3', '4,99x'])(
        'refuses %p on the field and does not move',
        async typed => {
          const { onConfirm } = await openWithPurchase();

          typeTotal(typed);
          confirm();

          expect(await screen.findByText(INVALID_PAID)).toBeTruthy();
          expect(onConfirm).not.toHaveBeenCalled();
        },
      );

      it('clears the refusal once fixed, and sends the total', async () => {
        const { onConfirm } = await openWithPurchase();
        typeTotal('4,99x');
        confirm();
        expect(await screen.findByText(INVALID_PAID)).toBeTruthy();

        typeTotal('3.49');
        await waitFor(() =>
          expect(screen.queryByText(INVALID_PAID)).toBeNull(),
        );
        confirm();

        await waitFor(() =>
          expect(onConfirm).toHaveBeenCalledWith(
            expect.objectContaining({ totalCost: 3.49 }),
          ),
        );
      });
    });

    it('holds the per-unit price when fewer units are stocked', async () => {
      const { onConfirm } = await openWithPurchase();

      typeQuantity('3');

      // The total follows the quantity; the unit price is what was paid.
      expect(totalPaid()).toBe('1.77');

      confirm();
      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: { measured: { quantity: 3, unitId: 'u1' } },
            totalCost: 1.77,
          }),
        ),
      );
    });

    it('closes once the move stands', async () => {
      const { onClose } = await openWithPurchase();

      confirm();

      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('stays open when the move is refused', async () => {
      const { onConfirm, onClose } = await openWithPurchase({
        onConfirm: jest.fn().mockResolvedValue(false),
      });

      confirm();

      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();
    });

    it('sends a whole count of jars with their size as packages', async () => {
      // A 22 oz jar moving onto a 32 oz stack keeps its size, counted in jars.
      const { onConfirm } = await openWithPurchase({
        line: JAR_LINE,
        header: 'Purchased: 5 jar',
      });

      typeSize('22', 'kg');
      confirm();

      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: {
              packages: {
                count: 5,
                size: { netWeight: 22, netWeightUnitId: 'unit-kg' },
                unitId: 'u-jar',
              },
            },
          }),
        ),
      );
    });

    // A size is one package's: beside an amount (5 gallons) it would read as
    // five packages of it, so the sheet asks instead of sending it.
    it('refuses a package size beside an amount, on the size', async () => {
      const { onConfirm } = await openWithPurchase();

      typeSize('22', 'kg');
      confirm();

      expect(await screen.findByText(NEEDS_COUNT)).toBeTruthy();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    // 64 fl oz with a size of 1 box is one box of 64 fl oz, stated the other
    // way round.
    it('reads an amount with a count of packages in its size as that many packages of it', async () => {
      const { onConfirm } = await openWithPurchase();

      typeSize('1', 'box');
      confirm();

      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: {
              packages: {
                count: 1,
                size: { netWeight: 5, netWeightUnitId: 'u1' },
                unitId: 'unit-box',
              },
            },
          }),
        ),
      );
      expect(screen.queryByText(NEEDS_COUNT)).toBeNull();
    });

    it('opens again with no package size from the last time', async () => {
      const { reopen } = await openWithPurchase();
      typeSize('1');

      reopen();

      await waitFor(() => expect(packageSize()).toBe(''));
    });

    describe('with the units the device holds', () => {
      beforeEach(() => {
        useStore.setState({
          cachedUnits: [
            {
              id: 'unit-carton',
              name: 'carton',
              symbol: 'carton',
              type: UnitType.Count,
            },
          ],
        });
      });
      afterEach(() => {
        useStore.setState({ cachedUnits: [], isOnline: true });
      });

      // The shopper types the container rather than picking it, one letter
      // wrong: "1 cartoon" beside the 5 gal bought.
      it('reads a unit typed and not picked as the unit it names', async () => {
        const { onConfirm } = await openWithPurchase();

        typeSize('1', { typed: 'cartoon' });
        // Named as it is typed: nothing says it is unknown.
        expect(screen.queryByText(/isn't a unit we know/)).toBeNull();
        confirm();

        await waitFor(() =>
          expect(onConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
              amount: {
                packages: {
                  count: 1,
                  size: { netWeight: 5, netWeightUnitId: 'u1' },
                  unitId: 'unit-carton',
                },
              },
              totalCost: 2.95,
            }),
          ),
        );
        expect(screen.getByTestId(`${SIZE_UNIT}-unit-input`).props.value).toBe(
          'carton',
        );
      });

      it('says a typed unit nobody can name is not one it knows', async () => {
        useStore.setState({ isOnline: false });
        const { onConfirm } = await openWithPurchase();

        typeSize('1', { typed: 'flagon' });
        confirm();

        expect(
          await screen.findByText(
            "That isn't a unit we know. Pick one from the list, like carton or jar.",
          ),
        ).toBeTruthy();
        expect(onConfirm).not.toHaveBeenCalled();
      });
    });

    // Bought as 5 gal for $2.95, stocked as 1 box of 5 gal: the same purchase,
    // so the same $2.95, never 1 × the price of a gallon.
    it('keeps what was paid when the purchase is restated in another unit', async () => {
      const { onConfirm } = await openWithPurchase();

      typeQuantity('1');
      expect(totalPaid()).toBe('0.59');
      fireEvent.press(screen.getByTestId('pick-box'));
      expect(totalPaid()).toBe('2.95');
      // Back in the unit it was paid in, the price follows the quantity again.
      fireEvent.press(screen.getByTestId('pick-gal'));
      typeQuantity('2');
      expect(totalPaid()).toBe('1.18');
      fireEvent.press(screen.getByTestId('pick-box'));
      expect(totalPaid()).toBe('2.95');

      typeSize('5', 'kg');
      confirm();

      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: {
              packages: {
                count: 2,
                size: { netWeight: 5, netWeightUnitId: 'unit-kg' },
                unitId: 'unit-box',
              },
            },
            totalCost: 2.95,
          }),
        ),
      );
    });

    it('still refuses a part of a package in the size', async () => {
      const { onConfirm } = await openWithPurchase();

      typeSize('1.5', 'box');
      confirm();

      expect(await screen.findByText(NEEDS_COUNT)).toBeTruthy();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    // The rule reads the quantity but reports on the size, so fixing the count
    // has to re-run it.
    it('clears the size refusal once the count is fixed', async () => {
      await openWithPurchase({ line: JAR_LINE, header: 'Purchased: 5 jar' });

      typeQuantity('2.5');
      typeSize('22', 'kg');
      confirm();
      expect(await screen.findByText(NEEDS_COUNT)).toBeTruthy();

      typeQuantity('2');

      await waitFor(() => expect(screen.queryByText(NEEDS_COUNT)).toBeNull());
    });

    it('raises no size refusal while the count is still being typed', async () => {
      await openWithPurchase({
        price: 1,
        line: JAR_LINE,
        header: 'Purchased: 5 jar',
      });
      typeSize('22', 'kg');

      typeQuantity('2.5');
      await waitFor(() => expect(totalPaid()).toBe('2.5'));

      expect(screen.queryByText(NEEDS_COUNT)).toBeNull();
    });

    // A line with no unit of its own counts in the purchase's, so the
    // purchase's kind decides whether a size can go with it — on a cold cache
    // (seeded a beat after opening) and a warm one (seeded on open) alike.
    it.each(['cold', 'warm'])(
      'takes a size beside a count the purchase was recorded in (%s cache)',
      async warmth => {
        const { onConfirm } = await openWithPurchase({
          unit: { symbol: 'jar', type: UnitType.Count },
          line: NO_UNIT_LINE,
          warm: warmth === 'warm',
          header: 'Purchased: 5 jar',
        });

        typeSize('22', 'kg');
        confirm();

        await waitFor(() =>
          expect(onConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
              amount: {
                packages: {
                  count: 5,
                  size: { netWeight: 22, netWeightUnitId: 'unit-kg' },
                  unitId: 'u-purchase',
                },
              },
            }),
          ),
        );
        expect(screen.queryByText(NEEDS_COUNT)).toBeNull();
      },
    );

    it('asks for the unit of a size given without one', async () => {
      const { onConfirm } = await openWithPurchase();

      typeSize('22');
      confirm();

      expect(await screen.findByTestId(`${SIZE_UNIT}-unit-error`)).toBeTruthy();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('takes the unit from the purchase when the line carries none', async () => {
      // `purchaseInfo` has the amounts but no unit, and a line's own unit is
      // nullable — `Purchase.unit` is not. The header names the unit the
      // fields resolved to. It read "Purchased: 5 " — the line's absent unit,
      // with nothing after the number — while submitting the purchase's, so
      // the label and the payload disagreed for exactly the case this
      // fallback exists to serve.
      const { onConfirm } = await openWithPurchase({
        line: NO_UNIT_LINE,
        header: 'Purchased: 5 lb',
      });

      confirm();

      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
      expect(onConfirm.mock.calls[0][0].amount.measured.unitId).toBe(
        'u-purchase',
      );
    });

    it("keeps the line's own unit when a purchase names a different one", async () => {
      // Warm cache — the normal path after Mark Purchased: the reset block and
      // the seed block run in the SAME render pass. `unitId` still holds its
      // pre-update value throughout, so the seed block read `null`, concluded
      // the line had no unit, and queued the purchase's AFTER the reset's —
      // moving the item in the purchase's unit instead of the one the line
      // and the header both show.
      const { onConfirm } = await openWithPurchase({ warm: true });

      confirm();
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());

      // The line's unit, not `u-purchase`.
      expect(onConfirm.mock.calls[0][0].amount.measured.unitId).toBe('u1');
    });

    it('falls back to the requested quantity when nothing was recorded', async () => {
      await openWithPurchase({
        quantity: null,
        price: null,
        header: 'Shopping list quantity: 2 gal',
      });

      expect(quantity()).toBe('2');
      expect(totalPaid()).toBe('');
    });
  });

  it('resets form when modal opens with new item', () => {
    const { rerender } = renderSheet({
      visible: false,
      shoppingListItemId: null,
    });
    rerender(<MoveToPantryModal {...defaultProps} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders with empty pantries list', () => {
    renderSheet({ pantries: [] });
    // Should still render but without pantry selector
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.queryByText('Select Pantry')).toBeNull();
  });

  it('hides empty pantries section label when no pantries', () => {
    renderSheet({ pantries: [] });
    expect(screen.queryByText('Kitchen Pantry')).toBeNull();
    expect(screen.queryByText('Garage')).toBeNull();
  });
});
