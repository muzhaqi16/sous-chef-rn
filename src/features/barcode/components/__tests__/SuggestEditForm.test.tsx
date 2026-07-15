'use no memo';

import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import {
  renderWithApollo,
  recordMock,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { SuggestEditForm } from '../SuggestEditForm';
import { GetItemForEditDocument } from '#hooks/items/useItemForEdit.generated';
import { ItemType, StorageState } from '#/graphql/generated/schemaTypes';

// AddItemForm drags in the whole form stack (react-hook-form, autocompletes,
// image picker). This suite is about what SuggestEditForm renders *around* it.
jest.mock('#components/organisms/AddItemForm/AddItemForm', () => ({
  __esModule: true,
  default: ({ mode }: { mode: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text testID="add-item-form">{mode}</Text>;
  },
}));

jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({ uploadItemImages: jest.fn(), uploading: false }),
}));

const itemData = (canEdit = false) => ({
  item: {
    __typename: 'Item' as const,
    id: 'item-1',
    name: 'Whole Milk',
    description: null,
    type: ItemType.Food,
    storageState: StorageState.Ambient,
    tags: [],
    primaryUpc: null,
    shelfLifeDays: null,
    shelfLifeOpenedDays: null,
    netWeight: null,
    baseDimension: null,
    imageUrl: null,
    canEdit,
    displayUnit: null,
    brands: [],
  },
});

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
  // to say so — it used to sit on a spinner that never resolved.
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
      data: itemData(true),
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
      data: itemData(false),
    });
    renderForm([mock]);

    await waitFor(() =>
      expect(screen.getByTestId('add-item-form')).toHaveTextContent('edit'),
    );
  });
});
