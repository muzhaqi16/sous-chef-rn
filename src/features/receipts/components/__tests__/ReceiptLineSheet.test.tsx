import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReceiptLineSheet } from '../ReceiptLineSheet';
import { t } from '#/i18n';
import { receiptsTestIDs } from '../../testIDs';
import { lineChoice } from '../../__tests__/helpers/receiptFixtures';
import { drainTimers } from '#/test-utils/drainTimers';

// The real slot, so the form's bar renders where the sheet holds it.
jest.mock('#components/templates/Sheet', () => {
  const { View } = require('react-native');
  const slot = jest.requireActual('#components/templates/SheetHeaderSlot');
  return {
    Sheet: ({ children }: { children?: React.ReactNode }) => {
      const store = slot.useSheetHeaderStore();
      return (
        <slot.SheetHeaderStoreProvider value={store}>
          <View>
            <slot.SheetHeaderOutlet store={store} />
            {children}
          </View>
        </slot.SheetHeaderStoreProvider>
      );
    },
  };
});

jest.mock('#components/organisms/Header', () => {
  const { Pressable, View } = require('react-native');
  return {
    Header: ({
      rightActions = [],
    }: {
      rightActions?: { onPress: () => void; testID?: string }[];
    }) => (
      <View>
        {rightActions.map(action => (
          <Pressable
            key={action.testID}
            testID={action.testID}
            onPress={action.onPress}
          />
        ))}
      </View>
    ),
  };
});

jest.mock('#features/catalog/ui/autocomplete/ItemAutocompleteField', () => ({
  ItemAutocompleteField: () => null,
}));

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => {
  const { Text, TextInput, View } = require('react-native');
  return {
    UnitAutocompleteField: ({
      value,
      onChangeText,
      error,
    }: {
      value?: string;
      onChangeText?: (text: string) => void;
      error?: string;
    }) => (
      <View>
        <TextInput
          testID="field-unit"
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text testID="field-unit-error">{error}</Text> : null}
      </View>
    ),
  };
});

// The units the device holds: "lb" resolves, anything else does not.
jest.mock('#features/catalog/hooks/useResolveUnit', () => ({
  useResolveUnit: () => ({
    resolveUnitId: async (current: string | null, text: string) =>
      current ?? (text === 'lb' ? 'unit-lb' : null),
  }),
}));

// The earlier purchases a line may be the receipt for, read through the API.
let mockEarlier: {
  id: string;
  version: number;
  amount: string;
  boughtOn: string;
}[] = [];
jest.mock('../useEarlierPurchases', () => ({
  useEarlierPurchases: () => mockEarlier,
}));

// The receipt's own currency is read through the API; here, the account's.
jest.mock('../../hooks/useReceiptCurrency', () => ({
  useReceiptMoney: () =>
    jest
      .requireActual<typeof import('#domain/money')>('#domain/money')
      .useMoney(),
}));

jest.mock('#components/molecules/FractionInput', () => ({
  FractionInput: () => null,
}));

jest.mock('#components/atoms/FormInput', () => {
  const { Text, TextInput, View } = require('react-native');
  return {
    FormInput: ({
      label,
      value,
      onChangeText,
      error,
    }: {
      label: string;
      value?: string;
      onChangeText?: (text: string) => void;
      error?: string;
    }) => (
      <View>
        <Text>{label}</Text>
        <TextInput
          testID={`field-${label}`}
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text testID={`field-${label}-error`}>{error}</Text> : null}
      </View>
    ),
  };
});

const TOTAL_NEEDED =
  "Enter what you paid for this line, or leave it empty if the receipt doesn't show it.";

const MILK = { index: 0, printed: 'MILK 2%', price: 2.5 };

const renderSheet = (line: typeof MILK & { discount?: number } = MILK) => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <ReceiptLineSheet
      visible
      line={line}
      choice={lineChoice({ price: line.price })}
      candidates={[]}
      listItemNameFor={() => undefined}
      onPickItem={jest.fn()}
      opening={1}
      onClose={onClose}
      onSave={onSave}
      onRemove={jest.fn()}
      canLeaveOut
    />,
  );
  return { onSave, onClose };
};

const renderUnchosenSheet = (canLeaveOut = true) => {
  const onSave = jest.fn();
  const onRemove = jest.fn();
  render(
    <ReceiptLineSheet
      visible
      line={MILK}
      choice={undefined}
      candidates={[]}
      listItemNameFor={() => undefined}
      onPickItem={jest.fn()}
      opening={1}
      onClose={jest.fn()}
      onSave={onSave}
      onRemove={onRemove}
      canLeaveOut={canLeaveOut}
    />,
  );
  return { onSave, onRemove };
};

const typeTotal = (text: string) =>
  fireEvent.changeText(screen.getByTestId('field-Total paid'), text);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the total paid on a receipt line', () => {
  it.each(['-3', '4,99x'])(
    'refuses %p on the field and does not save',
    async typed => {
      const { onSave } = renderSheet();

      typeTotal(typed);
      fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

      await drainTimers();
      expect(screen.getByTestId('field-Total paid-error')).toHaveTextContent(
        TOTAL_NEEDED,
      );
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('saves a usable total as the line price', async () => {
    const { onSave, onClose } = renderSheet();

    typeTotal('3.49');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ price: 3.49 }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('asks for what was paid when the total is 0 and no discount made it free', async () => {
    const { onSave } = renderSheet();

    typeTotal('0');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(screen.getByTestId('field-Total paid-error')).toHaveTextContent(
      TOTAL_NEEDED,
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  // IN-01: an unreadable total is left empty and the line still goes in, its
  // price unknown rather than zero.
  it('saves an emptied total as a price the receipt did not show', async () => {
    const { onSave } = renderSheet();

    typeTotal('');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ price: null }),
    );
  });

  it('saves a line its discount made free at nothing paid', async () => {
    const { onSave } = renderSheet({ ...MILK, price: 0, discount: 2.5 });

    typeTotal('0');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ price: 0 }));
  });
});

describe('the receipt for an earlier purchase', () => {
  const EGGS_BOUGHT = {
    id: 'IN-04-existing-purchase',
    version: 3,
    amount: '12 pc',
    boughtOn: '11/15/2026',
  };
  beforeEach(() => {
    mockEarlier = [EGGS_BOUGHT];
  });
  afterEach(() => {
    mockEarlier = [];
  });

  // IN-04: picked, the line fills in that purchase and stocks nothing again.
  it('saves the line as the receipt for the purchase picked', async () => {
    const { onSave } = renderSheet();

    fireEvent.press(screen.getByText('12 pc on 11/15/2026'));
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        existingPurchase: { id: 'IN-04-existing-purchase', version: 3 },
        notStocked: true,
      }),
    );
  });

  // A similar purchase may be another one: it is offered, never assumed.
  it('keeps the line a new purchase unless one is picked', async () => {
    const { onSave } = renderSheet();

    expect(screen.getByText('A new purchase')).toBeTruthy();
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.not.objectContaining({ existingPurchase: expect.anything() }),
    );
  });
});

describe('the unit of a receipt line', () => {
  it('saves a typed unit as the unit it resolves to', async () => {
    const { onSave } = renderSheet();

    fireEvent.changeText(screen.getByTestId('field-unit'), 'lb');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ unitId: 'unit-lb', unitText: 'lb' }),
    );
  });

  it('refuses a unit it cannot resolve on the field, and does not save', async () => {
    const { onSave } = renderSheet();

    fireEvent.changeText(screen.getByTestId('field-unit'), 'tin');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(screen.getByTestId('field-unit-error')).toHaveTextContent(
      '"tin" isn\'t a unit we recognise. Pick one from the list.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('a receipt line not for the pantry', () => {
  it('saves the switch onto the line', async () => {
    const { onSave } = renderSheet();

    fireEvent(
      screen.getByTestId(receiptsTestIDs.lineNotStocked),
      'valueChange',
      true,
    );
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ notStocked: true, itemName: 'Whole milk' }),
    );
  });

  it('lets a line with no product be left out', () => {
    const { onRemove } = renderUnchosenSheet();

    fireEvent.press(screen.getByText(t('receipts.review.dontAdd')));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not offer to leave out a line already left out', () => {
    renderUnchosenSheet(false);

    expect(screen.queryByText(t('receipts.review.dontAdd'))).toBeNull();
  });

  it('takes the printed name when nothing is chosen, so nothing need be typed', async () => {
    const { onSave } = renderUnchosenSheet();

    fireEvent(
      screen.getByTestId(receiptsTestIDs.lineNotStocked),
      'valueChange',
      true,
    );
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        notStocked: true,
        itemId: null,
        itemName: 'MILK 2%',
      }),
    );
  });
});

describe('a line whose amount is asked', () => {
  it('opens on what its list line asked for, so one save confirms it', async () => {
    const onSave = jest.fn();
    render(
      <ReceiptLineSheet
        visible
        line={MILK}
        choice={lineChoice({ quantity: 3, price: MILK.price })}
        asked={{ quantity: 2, unitId: 'unit-bottle', unitText: 'btl' }}
        candidates={[]}
        listItemNameFor={() => undefined}
        onPickItem={jest.fn()}
        opening={1}
        onClose={jest.fn()}
        onSave={onSave}
        onRemove={jest.fn()}
        canLeaveOut
      />,
    );
    expect(screen.getByTestId('field-unit')).toHaveProp('value', 'btl');

    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 2,
        unitId: 'unit-bottle',
        unitText: 'btl',
      }),
    );
  });
});
