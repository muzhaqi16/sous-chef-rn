import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import { kitTestIDs } from '#components/testIDs';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { StoreModeHeader } from '../StoreModeHeader';

// The picker's modal stands in as one button that picks a store.
jest.mock('#features/catalog/ui/autocomplete/StoreAutocompleteField', () => {
  const { Pressable } = require('react-native');
  return {
    StoreAutocompleteField: ({
      onStoreSelected,
      testID,
    }: {
      onStoreSelected: (id: string, name: string) => void;
      testID: string;
    }) => (
      <Pressable
        testID={testID}
        onPress={() => onStoreSelected('store-1', 'Aldi')}
      />
    ),
  };
});

type Props = React.ComponentProps<typeof StoreModeHeader>;

const props = (overrides: Partial<Props> = {}): Props => ({
  cartCount: 2,
  totalCount: 5,
  estimate: null,
  storeName: 'Costco',
  canChooseStore: true,
  onChooseStore: jest.fn(),
  routeNote: null,
  aisles: [
    { id: 'aisle:PRODUCE', department: StoreDepartment.Produce, count: 2 },
    { id: 'aisle:FROZEN', department: StoreDepartment.Frozen, count: 1 },
  ],
  lineCount: 3,
  tab: 'all',
  onTabChange: jest.fn(),
  ...overrides,
});

const aisleTab = (id: string) =>
  screen.getByTestId(
    kitTestIDs.filterTab(shoppingListTestIDs.aisleTabPrefix, id),
  );

describe('StoreModeHeader', () => {
  it('says how far the trip is and where it is', () => {
    render(<StoreModeHeader {...props()} />);

    expect(screen.getByText('2 of 5 items in the cart')).toBeTruthy();
    expect(screen.getByText('At Costco')).toBeTruthy();
  });

  it('asks for the store when the list names none, and picks it here', () => {
    const onChooseStore = jest.fn();
    render(<StoreModeHeader {...props({ storeName: null, onChooseStore })} />);

    expect(screen.getByText('Choose the store you are at')).toBeTruthy();
    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.storeModeChooseStore),
    );
    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.storeModeStoreField),
    );

    expect(onChooseStore).toHaveBeenCalledWith({ id: 'store-1', name: 'Aldi' });
  });

  it('asks no one for a store they cannot set', () => {
    render(
      <StoreModeHeader
        {...props({ storeName: null, canChooseStore: false })}
      />,
    );

    expect(screen.queryByText('Choose the store you are at')).toBeNull();
    expect(
      screen.queryByTestId(shoppingListTestIDs.storeModeStoreField),
    ).toBeNull();
  });

  it('says what the rest costs, and how much of it is priced', () => {
    const { rerender } = render(
      <StoreModeHeader
        {...props({ estimate: { price: '$12.00', priced: 3, lines: 3 } })}
      />,
    );
    expect(screen.getByText('≈ $12.00 to go')).toBeTruthy();

    rerender(
      <StoreModeHeader
        {...props({ estimate: { price: '$8.00', priced: 2, lines: 3 } })}
      />,
    );
    expect(screen.getByText('≈ $8.00 for 2 of the 3 items to go')).toBeTruthy();
  });

  it('offers every aisle on the list, then the cart', () => {
    const onTabChange = jest.fn();
    render(<StoreModeHeader {...props({ onTabChange })} />);

    expect(aisleTab('all')).toBeTruthy();
    fireEvent.press(aisleTab(StoreDepartment.Frozen));
    fireEvent.press(aisleTab('cart'));

    expect(onTabChange.mock.calls).toEqual([
      [StoreDepartment.Frozen],
      ['cart'],
    ]);
  });
});
