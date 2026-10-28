import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { StoreSection } from '../StoreSection';

jest.mock('#/services/errorService');

const STORE = { id: 'store-1', name: 'Giant Eagle' };

const renderSection = (
  props: Partial<React.ComponentProps<typeof StoreSection>> = {},
) => {
  const onPick = jest.fn();
  renderWithApollo(
    <StoreSection store={STORE} canEdit onPick={onPick} {...props} />,
    { operationMocks: [] },
  );
  return onPick;
};

describe('StoreSection', () => {
  // Retyping a store sends only its pick, never a clear on the way.
  it('keeps the store while its field is emptied, and clears it once finished', () => {
    const onPick = renderSection();
    const field = screen.getByTestId(shoppingListTestIDs.listBudgetStore);

    fireEvent.changeText(field, '');
    expect(onPick).not.toHaveBeenCalled();

    fireEvent(field, 'endEditing');
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('keeps the store when a typed name is finished without a pick', () => {
    const onPick = renderSection();
    const field = screen.getByTestId(shoppingListTestIDs.listBudgetStore);

    fireEvent.changeText(field, 'K');
    fireEvent(field, 'endEditing');

    expect(onPick).not.toHaveBeenCalled();
  });

  it('sends nothing when a field with no store is finished empty', () => {
    const onPick = renderSection({ store: null });

    fireEvent(
      screen.getByTestId(shoppingListTestIDs.listBudgetStore),
      'endEditing',
    );

    expect(onPick).not.toHaveBeenCalled();
  });

  it('shows a member who cannot edit the list the store as text', () => {
    renderSection({ store: null, canEdit: false });

    expect(screen.getByText('No store chosen')).toBeTruthy();
    expect(
      screen.queryByTestId(shoppingListTestIDs.listBudgetStore),
    ).toBeNull();
  });
});
