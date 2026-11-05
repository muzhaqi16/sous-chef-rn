import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ShoppingTab } from '../ShoppingTab';

const mockSetAddMenuOpen = jest.fn();
const mockOpenAddItemSheet = jest.fn();
let mockSearchQuery = '';

jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: () => ({ setAddMenuOpen: mockSetAddMenuOpen }),
}));

jest.mock('#features/shoppingList/context/ShoppingListModalsContext', () => ({
  useShoppingListModalActions: () => ({
    openAddItemSheet: mockOpenAddItemSheet,
  }),
}));

jest.mock('../ShoppingListTabsActionsContext', () => ({
  useShoppingListTabsActions: () => ({}),
}));

jest.mock('../ShoppingListDataContext', () => ({
  useShoppingListData: () => ({
    items: [],
    loading: false,
    isTransitioning: false,
    hasMore: false,
  }),
  useShoppingListSearchQuery: () => mockSearchQuery,
}));

jest.mock('#hooks/performance/useDeferredRender', () => ({
  useDeferredRender: () => true,
}));

// The list itself is FlashList's; what matters here is the empty state it is handed.
jest.mock('../StaggeredTabContent', () => ({
  StaggeredTabContent: ({
    listEmptyComponent,
  }: {
    listEmptyComponent: React.ReactNode;
  }) => listEmptyComponent,
}));

jest.mock(
  '#features/shoppingList/components/ShoppingEmptyIllustration',
  () => ({
    ShoppingEmptyIllustration: () => null,
  }),
);

describe('ShoppingTab empty state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery = '';
  });

  it("opens the floating +'s add menu from an empty Shopping view", async () => {
    const user = userEvent.setup();
    render(<ShoppingTab />);

    expect(screen.getByText('Your list is empty')).toBeTruthy();
    await user.press(screen.getByText('Add Item'));

    expect(mockSetAddMenuOpen).toHaveBeenCalledWith(true);
    expect(mockOpenAddItemSheet).not.toHaveBeenCalled();
  });

  it('keeps the no-match state on adding what was searched for', async () => {
    const user = userEvent.setup();
    mockSearchQuery = 'saffron';
    render(<ShoppingTab />);

    await user.press(screen.getByText('Add Item'));

    expect(mockOpenAddItemSheet).toHaveBeenCalledTimes(1);
    expect(mockSetAddMenuOpen).not.toHaveBeenCalled();
  });
});
