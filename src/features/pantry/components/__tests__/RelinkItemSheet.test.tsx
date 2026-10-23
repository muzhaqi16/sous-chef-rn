'use no memo';

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { RelinkItemSheet } from '../RelinkItemSheet';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import type { MoveOutcome } from '#features/pantry/hooks/mutations/useMovePantryItem';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

const mockSearch = jest.fn();
const mockReset = jest.fn();
let mockItems: Array<{ id: string; name: string; category: null }> = [];
jest.mock('#features/catalog/hooks/useItemAutocomplete', () => ({
  useItemAutocomplete: () => ({
    displayItems: mockItems,
    searchTerm: 'Bananas',
    isLoading: false,
    handleSearchTermChange: mockSearch,
    reset: mockReset,
  }),
}));

const mockMoveToItem = jest.fn<Promise<MoveOutcome>, unknown[]>();
jest.mock('#features/pantry/hooks/mutations/useMovePantryItem', () => ({
  useMovePantryItem: () => ({
    moveToItem: (...args: unknown[]) => mockMoveToItem(...args),
    moving: false,
  }),
}));

const mockToPantryItemDetail = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ toPantryItemDetail: mockToPantryItemDetail }),
}));

const STACK = {
  id: 'stack-1',
  version: 3,
  itemId: 'baby-food',
  itemName: 'Bananas',
};

const renderSheet = () => {
  const onDismiss = jest.fn();
  const onConflictRefresh = jest.fn();
  renderWithApollo(
    <RelinkItemSheet
      visible
      onDismiss={onDismiss}
      stack={STACK}
      onConflictRefresh={onConflictRefresh}
    />,
  );
  return { onDismiss, onConflictRefresh };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockItems = [
    { id: 'baby-food', name: 'Banana baby food', category: null },
    { id: 'produce-bananas', name: 'Bananas', category: null },
  ];
});

describe('RelinkItemSheet', () => {
  it("opens searching the entry's own name", () => {
    renderSheet();
    expect(mockSearch).toHaveBeenCalledWith('Bananas');
  });

  it('never offers the item the entry already is', () => {
    renderSheet();
    expect(
      screen.queryByTestId(pantryTestIDs.relinkCandidate('baby-food')),
    ).toBeNull();
    expect(
      screen.getByTestId(pantryTestIDs.relinkCandidate('produce-bananas')),
    ).toBeTruthy();
  });

  it('moves the entry to the picked item and says so', async () => {
    mockMoveToItem.mockResolvedValue({
      status: 'moved',
      receiptCorrectionRecorded: false,
    });
    const { onDismiss, onConflictRefresh } = renderSheet();

    fireEvent.press(screen.getByLabelText('Move to Bananas'));

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(mockMoveToItem).toHaveBeenCalledWith(
      STACK,
      'produce-bananas',
      onConflictRefresh,
    );
    expect(toastService.success).toHaveBeenCalledWith(
      "Done. It's now Bananas.",
    );
  });

  it('says when the next receipts will match the item too', async () => {
    mockMoveToItem.mockResolvedValue({
      status: 'moved',
      receiptCorrectionRecorded: true,
    });
    renderSheet();

    fireEvent.press(screen.getByLabelText('Move to Bananas'));

    await waitFor(() =>
      expect(toastService.success).toHaveBeenCalledWith(
        "Done. It's now Bananas, and your next receipts will match it too.",
      ),
    );
  });

  it('explains a refused move and opens the stack already there', async () => {
    mockMoveToItem.mockResolvedValue({
      status: 'duplicate',
      existingPantryItemId: 'stack-9',
    });
    renderSheet();

    fireEvent.press(screen.getByLabelText('Move to Bananas'));

    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Item Already in Pantry',
        expect.stringContaining('already has Bananas'),
        expect.any(Array),
      ),
    );
    const [, , buttons] = jest.mocked(alertService.alert).mock.calls[0] ?? [];
    buttons?.find(button => button.text === 'Open it')?.onPress?.();
    expect(mockToPantryItemDetail).toHaveBeenCalledWith({ itemId: 'stack-9' });
  });

  it('stays open when the move did not happen', async () => {
    mockMoveToItem.mockResolvedValue({ status: 'failed' });
    const { onDismiss } = renderSheet();

    fireEvent.press(screen.getByLabelText('Move to Bananas'));

    await waitFor(() => expect(mockMoveToItem).toHaveBeenCalled());
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('says when nothing matches', () => {
    mockItems = [];
    renderSheet();
    expect(screen.getByText('No results for "Bananas"')).toBeTruthy();
  });
});
