import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  ACTION_ITEM_ID,
  actionItemCache,
  rankedUnit,
} from '#/test-utils/fixtures/pantryActionFixtures';
import { ConsumptionUnitsForPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UnitType, WasteReason } from '#graphql/generated/schemaTypes';
import { t } from '#i18n';
import { BatchWasteSheet } from '../BatchWasteSheet';

const POUNDS = rankedUnit(
  { id: 'u1', symbol: 'lbs', name: 'Pounds', type: UnitType.Weight },
  0,
);
// Two of the stack's five pounds.
const BATCH = {
  id: 'b2',
  pantryItemId: ACTION_ITEM_ID,
  quantity: 2,
  remainingNetWeight: null,
};

const onConfirm = jest.fn(() => Promise.resolve('applied'));

async function openOn(wastingBatchId: string | null) {
  const log = operationLog();
  renderWithApollo(
    <BatchWasteSheet
      pantryItemId={ACTION_ITEM_ID}
      batches={[BATCH]}
      wastingBatchId={wastingBatchId}
      onClose={jest.fn()}
      onConfirm={onConfirm}
    />,
    {
      cache: actionItemCache(),
      links: [log.link],
      operationMocks: [
        recordMock(ConsumptionUnitsForPantryItemDocument, {
          data: { consumptionUnitsForPantryItem: [POUNDS] },
        }).mock,
      ],
    },
  );
  if (wastingBatchId) await log.landed(ConsumptionUnitsForPantryItemDocument);
}

beforeEach(() => jest.clearAllMocks());

describe('BatchWasteSheet', () => {
  it('opens on the batch, with the usual reason and all the batch holds', async () => {
    await openOn('b2');

    expect(screen.getByDisplayValue('2')).toBeOnTheScreen();
    expect(screen.getByText(t('labels.expired'))).toBeOnTheScreen();
  });

  it('throws the batch out whole when nothing is changed', async () => {
    await openOn('b2');

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: t('labels.recordWaste') }));

    expect(onConfirm).toHaveBeenCalledWith(
      BATCH,
      expect.objectContaining({
        quantity: 2,
        all: true,
        wasteReason: WasteReason.Expired,
      }),
    );
  });

  it('shows nothing with no batch being thrown out', async () => {
    await openOn(null);

    expect(screen.queryByText(t('labels.recordWaste'))).toBeNull();
  });
});
