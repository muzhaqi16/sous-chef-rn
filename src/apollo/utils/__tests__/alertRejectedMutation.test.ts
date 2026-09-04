/**
 * `field` routes to localized copy; the server's English `message` never shows.
 *
 * The rule lives in these two helpers rather than at each of their ~48 call
 * sites, so a site gets field-specific copy without asking for it and cannot
 * drift from the others.
 */
import {
  alertRejectedMutation,
  alertIfRejected,
} from '../alertRejectedMutation';
import { alertService } from '#/services/alertService';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockAlert = alertService.alert as jest.Mock;

const refusal = (field: string | null) => ({
  data: {
    updatePantryItem: {
      __typename: 'ValidationError',
      code: 'VALIDATION_FAILED',
      field,
      // Server-authored English. Nothing below ever renders it.
      message: 'Cannot change tracking unit while batches exist.',
    },
  },
});

describe('rejection copy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the app’s own copy for the field the server named', () => {
    alertRejectedMutation(refusal('unit'), 'Failed to update item');

    const [, message] = mockAlert.mock.calls[0];
    expect(message).toBe(
      "This item's unit can't be used right now. Deplete its batches first, or pick a unit it converts to \u2014 a made-up unit can't be measured against one.",
    );
  });

  // The API documents `field` as a dotted path in some responses.
  it('routes a dotted path to the same copy', () => {
    alertRejectedMutation(refusal('input.netWeight'), 'Failed to update item');

    const [, message] = mockAlert.mock.calls[0];
    expect(message).toBe(
      'Enter both a package size and its unit, or leave both empty.',
    );
  });

  it('never renders the server message', () => {
    alertRejectedMutation(refusal('unit'), 'Failed to update item');

    const [, message] = mockAlert.mock.calls[0];
    expect(message).not.toContain('Cannot change tracking unit');
  });

  it('keeps the caller’s copy for a field with no mapping', () => {
    alertRejectedMutation(
      refusal('somethingNobodyMapped'),
      'Failed to update item',
    );

    expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to update item');
  });

  it('keeps the caller’s copy for an unattributed refusal', () => {
    alertRejectedMutation(refusal(null), 'Failed to update item');

    expect(mockAlert).toHaveBeenCalledWith('Error', 'Failed to update item');
  });

  it('stays silent when a transport error already reported the failure', () => {
    alertRejectedMutation(
      { ...refusal('unit'), error: new Error('network down') },
      'Failed to update item',
    );

    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('applies the same routing through alertIfRejected', () => {
    expect(alertIfRejected(refusal('quantity'), 'Failed to update item')).toBe(
      true,
    );

    const [, message] = mockAlert.mock.calls[0];
    expect(message).toBe(
      "That quantity isn't valid. Try a number like 2, 0.5 or 1 1/2.",
    );
  });

  it('does not alert for a success payload', () => {
    expect(
      alertIfRejected(
        {
          data: {
            updatePantryItem: {
              __typename: 'UpdatePantryItemPayload',
              pantryItem: { id: '1' },
            },
          },
        },
        'Failed to update item',
      ),
    ).toBe(false);
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
