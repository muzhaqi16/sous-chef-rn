import React from 'react';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo as render,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { ReportItemForm } from '../ReportItemForm';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const REASON = 'The photo shows a completely different product.';

const CANDIDATES = [
  { id: 'item-1', name: 'Milk', brandName: 'Alpro' },
  { id: 'item-2', name: 'Milk Chocolate' },
];

const renderForm = (
  props: Partial<React.ComponentProps<typeof ReportItemForm>> = {},
  operationMocks: MockedResponse[] = [],
) => {
  const onClose = jest.fn();
  render(
    <ReportItemForm candidates={CANDIDATES} onClose={onClose} {...props} />,
    { operationMocks },
  );
  return { onClose };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ReportItemForm', () => {
  it('asks which item when there is more than one candidate', () => {
    renderForm();

    expect(screen.getByText('Which item has wrong details?')).toBeTruthy();
    expect(screen.queryByTestId('report-item-reason-input')).toBeNull();
  });

  it('skips the picker when only one item could be meant', () => {
    renderForm({ candidates: [CANDIDATES[0]] });

    expect(screen.queryByText('Which item has wrong details?')).toBeNull();
    expect(screen.getByTestId('report-item-reason-input')).toBeTruthy();
  });

  it('moves to the reason form once a candidate is picked', async () => {
    renderForm();

    await userEvent.press(screen.getByText('Milk Chocolate'));

    expect(screen.getByTestId('report-item-reason-input')).toBeTruthy();
  });

  it('sends the report and returns to the search step on success', async () => {
    const { mock, fired } = recordMock(MarkItemForReviewDocument, {
      data: {
        markItemForReview: {
          __typename: 'MarkItemForReviewPayload',
          item: { __typename: 'Item', id: 'item-1' },
        },
      },
    });
    const { onClose } = renderForm({ candidates: [CANDIDATES[0]] }, [mock]);

    await userEvent.type(
      screen.getByTestId('report-item-reason-input'),
      REASON,
    );
    await userEvent.press(screen.getByTestId('report-item-submit-button'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fired).toContainEqual({
      input: { itemId: 'item-1', reason: REASON },
    });
  });

  // The reason has to survive a retry, so a refusal must leave the step in place.
  it('stays on the step when the report is refused', async () => {
    const { mock } = recordMock(MarkItemForReviewDocument, {
      data: {
        markItemForReview: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'Reason too short',
          field: 'reason',
        },
      },
    });
    const { onClose } = renderForm({ candidates: [CANDIDATES[0]] }, [mock]);

    await userEvent.type(
      screen.getByTestId('report-item-reason-input'),
      REASON,
    );
    await userEvent.press(screen.getByTestId('report-item-submit-button'));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('report-item-reason-input').props.value).toBe(
      REASON,
    );
  });

  // Submit is disabled below MIN_EDIT_REASON_LENGTH, so no mock is needed —
  // firing one would surface as an unmatched-operation failure.
  it('does not submit a reason shorter than the minimum', async () => {
    const { onClose } = renderForm({ candidates: [CANDIDATES[0]] });

    await userEvent.type(screen.getByTestId('report-item-reason-input'), 'bad');
    await userEvent.press(screen.getByTestId('report-item-submit-button'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns to the search step without reporting when cancelled', async () => {
    const { onClose } = renderForm();

    await userEvent.press(screen.getByTestId('report-item-cancel-button'));

    expect(onClose).toHaveBeenCalled();
  });
});
