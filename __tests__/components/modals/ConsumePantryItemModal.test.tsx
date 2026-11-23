import React from 'react';
import { ConsumePantryItemModal } from '#features/pantry/components/modals/ConsumePantryItemModal';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  ACTION_ITEM_ID,
  actionItemCache,
} from '#/test-utils/fixtures/pantryActionFixtures';
import { ConsumptionUnitsForPantryItemDocument } from '#features/pantry/graphql/pantry.generated';

type Props = React.ComponentProps<typeof ConsumePantryItemModal>;

describe('ConsumePantryItemModal', () => {
  const defaultProps: Props = {
    visible: true,
    pantryItemId: ACTION_ITEM_ID,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  const renderModal = (props: Partial<Props> = {}) =>
    renderWithApollo(<ConsumePantryItemModal {...defaultProps} {...props} />, {
      cache: actionItemCache(),
      operationMocks: [
        recordMock(ConsumptionUnitsForPantryItemDocument, {
          data: { consumptionUnitsForPantryItem: [] },
        }).mock,
      ],
    });

  it('renders without crashing', () => {
    const { toJSON } = renderModal();
    expect(toJSON()).toBeTruthy();
  });

  it('shows Consume Item title', () => {
    const { getByText } = renderModal();
    expect(getByText('Consume Item')).toBeTruthy();
  });

  it('labels its confirm Confirm', () => {
    const { getByLabelText } = renderModal();
    expect(getByLabelText('Confirm')).toBeTruthy();
  });

  it('renders nothing with null pantryItemId', () => {
    const { queryByText } = renderModal({ pantryItemId: null });
    expect(queryByText('Consume Item')).toBeNull();
  });
});
