'use no memo';

import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  renderWithApollo,
  recordMock,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { SuggestEditForm } from '../SuggestEditForm';
import { GetItemForEditDocument } from '#features/catalog/hooks/useItemForEdit.generated';
import {
  ItemType,
  NetWeightKind,
  StorageState,
} from '#/graphql/generated/schemaTypes';

// AddItemForm drags in the whole form stack (react-hook-form, autocompletes,
// image picker). This suite is about what SuggestEditForm renders *around* it.
jest.mock('#features/catalog/ui/AddItemForm/AddItemForm', () => ({
  __esModule: true,
  default: ({
    mode,
    initialData,
  }: {
    mode: string;
    initialData?: { netWeights?: Array<{ value: number; unitName: string }> };
  }) => {
    const { Text } = jest.requireActual('react-native');
    const [weight] = initialData?.netWeights ?? [];
    return (
      <>
        <Text testID="add-item-form">{mode}</Text>
        <Text testID="prefilled-size">
          {weight ? `${weight.value} ${weight.unitName}` : 'none'}
        </Text>
      </>
    );
  },
}));

jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({ uploadItemImages: jest.fn(), uploading: false }),
}));

// Defaults to the common target: a public catalog item this user may propose
// edits to but not write through.
const itemData = ({ canEdit = false, canSuggest = true } = {}): MockDataFor<
  typeof GetItemForEditDocument
> => ({
  item: {
    __typename: 'Item',
    id: 'item-1',
    name: 'Whole Milk',
    description: null,
    type: ItemType.Food,
    storageState: StorageState.Ambient,
    tags: [],
    primaryUpc: null,
    shelfLifeDays: null,
    shelfLifeOpenedDays: null,
    netWeight: 1000,
    netWeightKind: NetWeightKind.Package,
    baseDimension: null,
    imageUrl: null,
    canEdit,
    canSuggest,
    displayUnit: { __typename: 'Unit', id: 'unit-g', name: 'g', symbol: 'g' },
    brands: [],
  },
});

// The pack a barcode lookup reported: a 500 g jar of a 1 kg catalog item.
const SCANNED_PACK = {
  variationId: 'esm-1',
  netWeight: 500,
  netWeightKind: NetWeightKind.Package,
  displayUnit: { id: 'unit-g', name: 'g' },
};

const renderForm = (operationMocks: MockedResponse[]) =>
  renderWithApollo(<SuggestEditForm itemId="item-1" onClose={jest.fn()} />, {
    operationMocks,
  });

describe('SuggestEditForm', () => {
  it('renders the form once the snapshot loads', async () => {
    const { mock } = recordMock(GetItemForEditDocument, {
      data: itemData(),
    });
    renderForm([mock]);

    await waitFor(() =>
      expect(screen.getByTestId('add-item-form')).toBeOnTheScreen(),
    );
  });

  // Without the snapshot there is nothing to diff against, so a failed load has
  // to say so rather than sit on a spinner that never resolves.
  it('offers a retry when the item cannot be loaded', async () => {
    renderForm([
      {
        request: { query: GetItemForEditDocument, variables: { id: 'item-1' } },
        error: new Error('offline'),
      },
    ]);

    await waitFor(() =>
      expect(screen.getByText("Couldn't load this item")).toBeOnTheScreen(),
    );
    expect(screen.getByText('Try again')).toBeOnTheScreen();
    expect(screen.queryByTestId('add-item-form')).not.toBeOnTheScreen();
  });

  it('recovers when the retry succeeds', async () => {
    renderForm([
      {
        request: { query: GetItemForEditDocument, variables: { id: 'item-1' } },
        error: new Error('offline'),
      },
      {
        request: { query: GetItemForEditDocument, variables: { id: 'item-1' } },
        result: { data: itemData() },
      },
    ]);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Try again' }),
      ).toBeOnTheScreen(),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(screen.getByTestId('add-item-form')).toBeOnTheScreen(),
    );
  });

  it('words the form as a direct edit when the user may edit it', async () => {
    const { mock } = recordMock(GetItemForEditDocument, {
      data: itemData({ canEdit: true }),
    });
    renderForm([mock]);

    await waitFor(() =>
      expect(screen.getByTestId('add-item-form')).toHaveTextContent(
        'directEdit',
      ),
    );
  });

  it('words the form as a suggestion when the user may not', async () => {
    const { mock } = recordMock(GetItemForEditDocument, {
      data: itemData({ canEdit: false }),
    });
    renderForm([mock]);

    await waitFor(() =>
      expect(screen.getByTestId('add-item-form')).toHaveTextContent('edit'),
    );
  });

  // Both paths closed — a PRIVATE item the user doesn't own. Rendering the form
  // would invite an edit that could only be refused on submit, so the sheet says
  // so instead. Reachable even though the card hides its edit action for such an
  // item: a cached scan carries no flags, and only this snapshot is authoritative.
  // A suggestion from a scan corrects that barcode's pack, so it opens on the
  // pack the scan showed rather than on the item's own figure.
  it('opens a suggestion on the scanned pack', async () => {
    const { mock } = recordMock(GetItemForEditDocument, { data: itemData() });
    renderWithApollo(
      <SuggestEditForm
        itemId="item-1"
        scan={SCANNED_PACK}
        onClose={jest.fn()}
      />,
      { operationMocks: [mock] },
    );

    await waitFor(() =>
      expect(screen.getByTestId('prefilled-size')).toHaveTextContent('500 g'),
    );
  });

  // A direct edit writes the item, so it stays on the item's own figure.
  it("opens a direct edit on the item's own size", async () => {
    const { mock } = recordMock(GetItemForEditDocument, {
      data: itemData({ canEdit: true }),
    });
    renderWithApollo(
      <SuggestEditForm
        itemId="item-1"
        scan={SCANNED_PACK}
        onClose={jest.fn()}
      />,
      { operationMocks: [mock] },
    );

    await waitFor(() =>
      expect(screen.getByTestId('prefilled-size')).toHaveTextContent('1000 g'),
    );
  });

  it('states the item is read-only when neither write path is open', async () => {
    const { mock } = recordMock(GetItemForEditDocument, {
      data: itemData({ canEdit: false, canSuggest: false }),
    });
    renderForm([mock]);

    await waitFor(() =>
      expect(screen.getByText("This item can't be edited")).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId('add-item-form')).not.toBeOnTheScreen();
  });
});
