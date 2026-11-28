'use no memo';
import React from 'react';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { t } from '#i18n';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { GenerateShoppingListSheet } from '../GenerateShoppingListSheet';

type SheetProps = React.ComponentProps<typeof GenerateShoppingListSheet>;

function listsMock() {
  return recordMock(GetShoppingListsLiteDocument, {
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        edges: [
          {
            __typename: 'ShoppingListEdge',
            cursor: 'c1',
            node: {
              __typename: 'ShoppingList',
              id: 'sl-1',
              name: 'Weekly Groceries',
              totalItems: 10,
            },
          },
          {
            __typename: 'ShoppingListEdge',
            cursor: 'c2',
            node: {
              __typename: 'ShoppingList',
              id: 'sl-2',
              name: 'Party Supplies',
              totalItems: 5,
            },
          },
        ],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  }).mock;
}

let log = operationLog();

const sheet = (props: Partial<SheetProps> = {}) => (
  <GenerateShoppingListSheet {...defaultProps} {...props} />
);

function renderSheet(props: Partial<SheetProps> = {}) {
  return renderWithApollo(sheet(props), {
    operationMocks: [listsMock()],
    links: [log.link],
  });
}

const generateButton = () =>
  screen.getByRole('button', { name: t('generateShoppingList.generate') });

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

jest.mock('#components/atoms/BaseSwitch', () => ({
  BaseSwitch: ({
    value,
    onValueChange,
  }: {
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="base-switch" onPress={() => onValueChange(!value)}>
        <Text>{value ? 'ON' : 'OFF'}</Text>
      </Pressable>
    );
  },
}));

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  onGenerate: jest.fn(),
  loading: false,
};

describe('GenerateShoppingListSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    log = operationLog();
  });

  it('renders the generate action', () => {
    renderSheet();
    expect(generateButton()).toBeEnabled();
  });

  it('renders the check pantry toggle', () => {
    renderSheet();
    expect(screen.getByText('Check pantry availability')).toBeTruthy();
    expect(
      screen.getByText('Deduct items you already have in your pantry'),
    ).toBeTruthy();
  });

  it('renders the destination mode selector', () => {
    renderSheet();
    expect(screen.getByText('Destination')).toBeTruthy();
    expect(screen.getByText('New List')).toBeTruthy();
    expect(screen.getByText('Existing List')).toBeTruthy();
  });

  it('names the sheet', () => {
    renderSheet();
    expect(
      screen.getByText(t('mealPlanMain.generateShoppingListLabel')),
    ).toBeTruthy();
  });

  it('holds the generate while one is in flight', () => {
    renderSheet({ loading: true });
    expect(generateButton()).toBeDisabled();
    expect(screen.getByText('Generating shopping list...')).toBeTruthy();
  });

  it('shows home sharing info when homeName is provided', () => {
    renderSheet({ homeName: 'My Home' });
    expect(
      screen.getByText('The shopping list will be shared with My Home'),
    ).toBeTruthy();
  });

  it('does not show home sharing info when homeName is not provided', () => {
    renderSheet();
    expect(screen.queryByText(/shared with/)).toBeNull();
  });

  it('shows custom name input in "new" mode', () => {
    renderSheet();
    expect(screen.getByText('List Name (optional)')).toBeTruthy();
  });

  it('shows existing lists when switching to "existing" mode', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.press(screen.getByText('Existing List'));
    expect(screen.getByText('Select a list')).toBeTruthy();
    await log.landed(GetShoppingListsLiteDocument);
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
    expect(screen.getByText('Party Supplies')).toBeTruthy();
  });

  it('offers to read the lists again, never that there are none', async () => {
    const user = userEvent.setup();
    const failed = recordMock(GetShoppingListsLiteDocument, {
      error: new Error('network down'),
      maxUsageCount: 1,
    });
    renderWithApollo(sheet(), {
      operationMocks: [failed.mock, listsMock()],
      links: [log.link],
    });
    await user.press(screen.getByText('Existing List'));
    await log.landed(GetShoppingListsLiteDocument);
    expect(screen.queryByText(t('generateShoppingList.noLists'))).toBeNull();

    await user.press(screen.getByText(t('labels.tryAgain')));
    await log.landed(GetShoppingListsLiteDocument, 2);
    expect(screen.getByText('Weekly Groceries')).toBeTruthy();
  });

  it('calls onGenerate when confirm button is pressed', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.press(generateButton());
    expect(defaultProps.onGenerate).toHaveBeenCalledWith({
      checkPantry: true,
      name: undefined,
      shoppingListId: undefined,
    });
  });

  it('names the new list as typed, trimmed, without the pantry check', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.press(screen.getByTestId('base-switch'));
    fireEvent.changeText(
      screen.getByPlaceholderText(
        t('generateShoppingList.listNamePlaceholder'),
      ),
      '  Party  ',
    );
    await user.press(generateButton());
    expect(defaultProps.onGenerate).toHaveBeenCalledWith({
      checkPantry: false,
      name: 'Party',
      shoppingListId: undefined,
    });
  });

  it('generates into the list picked', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.press(screen.getByText('Existing List'));
    await log.landed(GetShoppingListsLiteDocument);
    await user.press(screen.getByText('Party Supplies'));
    await user.press(generateButton());
    expect(defaultProps.onGenerate).toHaveBeenCalledWith({
      checkPantry: true,
      name: undefined,
      shoppingListId: 'sl-2',
    });
  });

  it('asks for a list on the field when generating into one with none picked', async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.press(screen.getByText('Existing List'));
    await log.landed(GetShoppingListsLiteDocument);
    const pickAList = t('generateShoppingList.selectListLabel');
    expect(screen.getAllByText(pickAList)).toHaveLength(1);

    await user.press(generateButton());

    // The field's label, and now its message.
    expect(screen.getAllByText(pickAList)).toHaveLength(2);
    expect(defaultProps.onGenerate).not.toHaveBeenCalled();
    expect(generateButton()).toBeEnabled();

    await user.press(screen.getByText('Weekly Groceries'));
    expect(screen.getAllByText(pickAList)).toHaveLength(1);
  });

  it('opens fresh: the destination and name go with the closing', async () => {
    const user = userEvent.setup();
    const view = renderSheet();
    fireEvent.changeText(
      screen.getByPlaceholderText(
        t('generateShoppingList.listNamePlaceholder'),
      ),
      'Party',
    );
    await user.press(screen.getByText('Existing List'));

    view.rerender(sheet({ visible: false }));
    view.rerender(sheet());

    expect(
      screen.getByPlaceholderText(
        t('generateShoppingList.listNamePlaceholder'),
      ),
    ).toHaveDisplayValue('');
    expect(screen.queryByText('Select a list')).toBeNull();
  });
});
