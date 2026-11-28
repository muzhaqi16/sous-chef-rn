import React from 'react';
import {
  fireEvent,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { alertService } from '#services/alertService';
import { RecordWastePantryItemModal } from '#features/pantry/components/modals/RecordWastePantryItemModal';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  ACTION_ITEM_ID,
  actionItemCache,
  rankedUnit,
} from '#/test-utils/fixtures/pantryActionFixtures';
import { ConsumptionUnitsForPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UnitType, WasteReason } from '#graphql/generated/schemaTypes';
import { localizeNumericHint } from '#utils/formatters/number';
import { t } from '#i18n';

type Props = React.ComponentProps<typeof RecordWastePantryItemModal>;

const POUNDS = rankedUnit(
  { id: 'u1', symbol: 'lbs', name: 'Pounds', type: UnitType.Weight },
  0,
);

let log = operationLog();

const onClose = jest.fn();
const onConfirm = jest.fn();

const sheet = (over: Partial<Props> = {}) => (
  <RecordWastePantryItemModal
    visible
    pantryItemId={ACTION_ITEM_ID}
    onClose={onClose}
    onConfirm={onConfirm}
    {...over}
  />
);

/** The sheet over five pounds of flour, once its units are read. */
async function openWaste(over: Partial<Props> = {}) {
  const view = renderWithApollo(sheet(over), {
    cache: actionItemCache(),
    links: [log.link],
    operationMocks: [
      recordMock(ConsumptionUnitsForPantryItemDocument, {
        data: { consumptionUnitsForPantryItem: [POUNDS] },
      }).mock,
    ],
  });
  await log.landed(ConsumptionUnitsForPantryItemDocument);
  return view;
}

/** The amount field's wrapper, by the label a user reads; it holds the error. */
const amountField = () => {
  const [wrapper] = screen.getAllByLabelText(t('recordWaste.wasteAmount'));
  if (!wrapper) throw new Error('no waste amount field');
  return wrapper;
};
const amountInput = () =>
  within(amountField()).getByPlaceholderText(
    localizeNumericHint(t('labels.eG1114Or15')),
  );

const typeAmount = (text: string) => fireEvent.changeText(amountInput(), text);
// The form checks as it confirms, and re-checks a field edited after a
// confirm, both asynchronously: each awaits the user's event.
const confirm = () =>
  userEvent
    .setup()
    .press(screen.getByRole('button', { name: t('labels.recordWaste') }));
const retypeAmount = async (text: string) => {
  const user = userEvent.setup();
  await user.clear(amountInput());
  await user.type(amountInput(), text);
};

const MORE_THAN_HELD = (amount = '5') =>
  t('deduction.exceedsAvailableWaste', { amount, unit: 'lbs' });

/** A waste as the sheet states it, nothing changed but `over`. */
const stated = (over: Record<string, unknown> = {}) => ({
  quantity: 5,
  all: false,
  wasteReason: WasteReason.Expired,
  isComposted: false,
  isRecycled: false,
  notes: '',
  usageUnitId: 'u1',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
});

describe('RecordWastePantryItemModal', () => {
  it('renders with title Record Waste', async () => {
    await openWaste();
    expect(screen.getByText('Record Waste')).toBeTruthy();
  });

  it('shows waste reason options when expanded', async () => {
    const user = userEvent.setup();
    await openWaste();
    // Collapsed by default — only selected value visible in header
    expect(screen.getByText('Expired')).toBeTruthy();
    // Expand the collapsible picker
    await user.press(screen.getByText('Waste Reason *'));
    expect(screen.getByText('Spoiled')).toBeTruthy();
  });

  it('shows sustainability checkboxes', async () => {
    await openWaste();
    expect(screen.getByText('Composted')).toBeTruthy();
    expect(screen.getByText('Recycled (packaging)')).toBeTruthy();
  });

  // The caller closes it once the waste is recorded.
  it('records all the stack holds when nothing is typed', async () => {
    await openWaste();

    expect(amountInput()).toHaveDisplayValue('5');
    await confirm();

    expect(onConfirm).toHaveBeenCalledWith(stated());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps everything entered when the waste is refused', async () => {
    const user = userEvent.setup();
    onConfirm.mockResolvedValueOnce('failed');
    await openWaste();

    typeAmount('2');
    await user.press(screen.getByText('Waste Reason *'));
    await user.press(screen.getByText('Spoiled'));
    fireEvent.press(screen.getByText('Composted'));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('recordWaste.notesPlaceholder')),
      'went mouldy',
    );
    await confirm();

    expect(onClose).not.toHaveBeenCalled();
    expect(amountInput()).toHaveDisplayValue('2');
    expect(screen.getByText('Spoiled')).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Composted', checked: true }),
    ).toBeVisible();
    expect(screen.getByDisplayValue('went mouldy')).toBeVisible();
  });

  it('records the reason, what was kept from the bin, and the notes', async () => {
    const user = userEvent.setup();
    await openWaste();

    typeAmount('2');
    await user.press(screen.getByText('Waste Reason *'));
    await user.press(screen.getByText('Spoiled'));
    fireEvent.press(screen.getByText('Composted'));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('recordWaste.notesPlaceholder')),
      'went mouldy',
    );
    await confirm();

    expect(onConfirm).toHaveBeenCalledWith(
      stated({
        quantity: 2,
        wasteReason: WasteReason.Spoiled,
        isComposted: true,
        notes: 'went mouldy',
      }),
    );
  });

  // An amount the person can fix is shown where they fix it, never as an alert.
  it('says on the amount field that it is more than is held', async () => {
    await openWaste();

    typeAmount('15');
    await confirm();

    expect(within(amountField()).getByText(MORE_THAN_HELD())).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps saying so while the amount is still more than is held', async () => {
    await openWaste();
    typeAmount('15');
    await confirm();

    await retypeAmount('12');

    expect(within(amountField()).getByText(MORE_THAN_HELD())).toBeTruthy();
  });

  it('clears the amount error once the amount is edited', async () => {
    await openWaste();
    typeAmount('15');
    await confirm();
    expect(within(amountField()).getByText(MORE_THAN_HELD())).toBeTruthy();

    await retypeAmount('5');

    expect(within(amountField()).queryByText(MORE_THAN_HELD())).toBeNull();
  });

  it('starts fresh each time it opens, with no error left from the last', async () => {
    const view = await openWaste();
    fireEvent.press(screen.getByText('Composted'));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('recordWaste.notesPlaceholder')),
      'half a bag',
    );
    typeAmount('15');
    await confirm();
    expect(within(amountField()).getByText(MORE_THAN_HELD())).toBeTruthy();

    view.rerender(sheet({ visible: false }));
    view.rerender(sheet());

    expect(amountInput()).toHaveDisplayValue('5');
    expect(within(amountField()).queryByText(MORE_THAN_HELD())).toBeNull();
    await confirm();
    expect(onConfirm).toHaveBeenCalledWith(stated());
  });

  describe('from one batch', () => {
    const batch = { quantity: 2, remainingNetWeight: null };

    it('throws the batch out whole when nothing is typed', async () => {
      await openWaste({ batch });

      expect(amountInput()).toHaveDisplayValue('2');
      await confirm();

      expect(onConfirm).toHaveBeenCalledWith(
        stated({ quantity: 2, all: true }),
      );
    });

    it('holds the amount to what the batch holds', async () => {
      await openWaste({ batch });

      typeAmount('3');
      await confirm();

      expect(within(amountField()).getByText(MORE_THAN_HELD('2'))).toBeTruthy();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('records part of the batch as part of it', async () => {
      await openWaste({ batch });

      typeAmount('1');
      await confirm();

      expect(onConfirm).toHaveBeenCalledWith(stated({ quantity: 1 }));
    });
  });
});
