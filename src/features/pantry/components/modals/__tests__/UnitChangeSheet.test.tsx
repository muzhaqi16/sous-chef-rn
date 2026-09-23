import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  ErrorCode,
  PantryUnitChangeMethod,
  PantryUnitChangeResolution,
} from '#/graphql/generated/schemaTypes';
import type { UnitChangePreview } from '#features/pantry/hooks/usePantryUnitChange';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { UnitChangeSheet } from '../UnitChangeSheet';

const mockPreview = jest.fn();
const mockChange = jest.fn();
jest.mock('#features/pantry/hooks/usePantryUnitChange', () => ({
  usePantryUnitChange: () => ({ preview: mockPreview, change: mockChange }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockChange.mockResolvedValue({ status: 'changed' });
});

const unit = (id: string, symbol: string): UnitChangePreview['toUnit'] => ({
  __typename: 'Unit',
  id,
  symbol,
  displayAsFraction: true,
});

const preview = (over: Partial<UnitChangePreview> = {}): UnitChangePreview => ({
  __typename: 'PantryUnitChangePreview',
  version: 3,
  method: PantryUnitChangeMethod.Conversion,
  exact: true,
  quantityIgnored: false,
  fromUnit: unit('u-ct', 'ct'),
  toUnit: unit('u-lb', 'lb'),
  quantityBefore: 2,
  heldQuantityBefore: 2,
  quantityAfter: 1.5,
  heldQuantityAfter: 1.5,
  batches: [],
  minQuantityAfter: null,
  restockQuantityAfter: null,
  dropsNetWeight: false,
  dropsPortions: false,
  dropsThresholds: false,
  conflictingPantryItemId: null,
  refusal: null,
  ...over,
});

function renderSheet(
  initialPreview: UnitChangePreview,
  typedQuantity: number | null = null,
) {
  const onChanged = jest.fn();
  renderWithApollo(
    <UnitChangeSheet
      pantryItemId="pi-1"
      unitId="u-lb"
      typedQuantity={typedQuantity}
      initialPreview={initialPreview}
      onClose={jest.fn()}
      onChanged={onChanged}
    />,
  );
  return { onChanged };
}

const confirm = () =>
  fireEvent.press(screen.getByTestId(pantryTestIDs.unitChangeConfirm));

it('shows the before and after of an exact route, and makes the change', async () => {
  const { onChanged } = renderSheet(preview());

  expect(screen.getByText('2 ct → 1 1/2 lb')).toBeTruthy();
  expect(screen.getByText('Exact conversion.')).toBeTruthy();
  confirm();

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(mockChange).toHaveBeenCalledWith({
    pantryItemId: 'pi-1',
    unitId: 'u-lb',
    version: 3,
    packageSize: undefined,
  });
});

it('says an amount typed with an exact route is not used', () => {
  renderSheet(preview({ quantityIgnored: true }), 0.5);
  expect(
    screen.getByText(
      "The amount you entered isn't used: the stock converts exactly.",
    ),
  ).toBeTruthy();
});

it('says why the amount entered replaces the old one', () => {
  renderSheet(
    preview({ method: PantryUnitChangeMethod.Recount, exact: null }),
    0.5,
  );
  expect(
    screen.getByText(
      "These units don't convert for this item, so the amount you entered replaces the old one.",
    ),
  ).toBeTruthy();
});

it('asks for the amount where no route exists, and recounts with it', async () => {
  // 2 pieces of chicken with no size, restated as 1/2 lb.
  renderSheet(
    preview({
      method: null,
      exact: null,
      quantityAfter: null,
      refusal: {
        __typename: 'PantryUnitChangeRefusal',
        code: ErrorCode.ValidationFailed,
        field: 'quantity',
      },
    }),
    0.5,
  );

  expect(
    screen.getByText(
      "ct can't be converted to lb for this item, so enter how much you have in lb.",
    ),
  ).toBeTruthy();
  confirm();

  await waitFor(() =>
    expect(mockChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: PantryUnitChangeResolution.Recount,
        quantity: 0.5,
      }),
    ),
  );
});

it('offers the estimate beside an amount of their own', async () => {
  renderSheet(
    preview({
      exact: false,
      refusal: {
        __typename: 'PantryUnitChangeRefusal',
        code: ErrorCode.UnitChangeNeedsResolution,
        field: 'resolution',
      },
    }),
  );

  expect(screen.getByText('Use the estimate: about 1 1/2 lb')).toBeTruthy();
  confirm();

  await waitFor(() =>
    expect(mockChange).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: PantryUnitChangeResolution.Convert,
      }),
    ),
  );
});

it('previews again when the stack changed since, and says so', async () => {
  mockChange.mockResolvedValue({ status: 'conflict' });
  mockPreview.mockResolvedValue({
    status: 'ready',
    preview: preview({ version: 4, quantityBefore: 3 }),
  });
  renderSheet(preview());

  confirm();

  expect(
    await screen.findByText(
      'This item changed while you were looking. Check the new figures and confirm again.',
    ),
  ).toBeTruthy();
  expect(screen.getByText('3 ct → 1 1/2 lb')).toBeTruthy();
});

it('keeps the sheet open with the reason when the change is refused', async () => {
  mockChange.mockResolvedValue({
    status: 'failed',
    field: 'quantity',
    message: 'That quantity isn’t valid.',
  });
  const { onChanged } = renderSheet(preview());

  confirm();

  expect(
    await screen.findByTestId(pantryTestIDs.unitChangeError),
  ).toHaveTextContent('That quantity isn’t valid.');
  expect(onChanged).not.toHaveBeenCalled();
});

it('offers no change when the item is already held in the new unit', () => {
  renderSheet(preview({ conflictingPantryItemId: 'pi-2' }));

  expect(
    screen.getByText(
      'You already have this item tracked in lb. Change that one instead, or pick a different unit.',
    ),
  ).toBeTruthy();
  expect(screen.queryByTestId(pantryTestIDs.unitChangeConfirm)).toBeNull();
});

it('warns about what the change drops', () => {
  renderSheet(preview({ dropsNetWeight: true, dropsThresholds: true }));

  expect(screen.getByText('The package size will be removed.')).toBeTruthy();
  expect(
    screen.getByText('The low-stock alert levels will be cleared.'),
  ).toBeTruthy();
});
