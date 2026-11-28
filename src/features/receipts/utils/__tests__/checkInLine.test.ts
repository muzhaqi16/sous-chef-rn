import { ReceiptMatchMethod, UnitType } from '#graphql/generated/schemaTypes';
import { checkInLineOf } from '../checkInLine';
import { lineChoice } from '../../__tests__/helpers/receiptFixtures';

const IDS = {
  purchaseId: 'pur-1',
  pantryItemId: 'pi-1',
  newItemId: 'item-new',
};
const MAYO = { index: 24, printed: 'MAYONNAISE AC', discount: 1 };
const EGGS_LINE = {
  id: 'line-eggs',
  quantity: 12,
  unit: { id: 'unit-pc', type: UnitType.Count },
};

describe('checkInLineOf', () => {
  it('states a coupon apart from the total paid', () => {
    expect(
      checkInLineOf({
        line: MAYO,
        choice: lineChoice({ itemId: 'item-mayo', price: 6.49 }),
        ids: IDS,
        heldUnit: null,
        proposed: {
          itemId: 'item-mayo',
          method: ReceiptMatchMethod.Search,
          preselected: true,
        },
      }),
    ).toEqual({
      input: {
        clientId: '24',
        purchaseId: 'pur-1',
        pantryItemId: 'pi-1',
        item: { id: 'item-mayo' },
        amount: { packages: { count: 1 } },
        totalPaid: 6.49,
        discount: 1,
        rawText: 'MAYONNAISE AC',
        resolvedBy: ReceiptMatchMethod.Search,
        edited: false,
      },
    });
  });

  it('sends a line its discount made free at nothing paid', () => {
    const result = checkInLineOf({
      line: { index: 3, printed: 'BOGO CHIPS', discount: 3.99 },
      choice: lineChoice({ itemId: 'item-chips', price: 0 }),
      ids: IDS,
      heldUnit: null,
    });

    expect(result).toMatchObject({
      input: { totalPaid: 0, discount: 3.99 },
    });
  });

  it("names a typed product inline under the line's minted item id", () => {
    const result = checkInLineOf({
      line: { index: 5, printed: 'CUBANELLE PEPPE' },
      choice: lineChoice({
        itemId: null,
        itemName: ' Cubanelle pepper ',
        price: 3.5,
      }),
      ids: IDS,
      heldUnit: null,
    });

    expect(result).toMatchObject({
      input: {
        item: { inline: { id: 'item-new', name: 'Cubanelle pepper' } },
        resolvedBy: null,
        edited: true,
      },
    });
    expect(result).not.toHaveProperty('input.discount');
  });

  it('ticks the list line it matches, and can leave the pantry alone', () => {
    const result = checkInLineOf({
      line: { index: 0, printed: 'EGGS' },
      choice: lineChoice({ itemId: 'item-eggs', price: 4.2, notStocked: true }),
      ids: IDS,
      listLine: EGGS_LINE,
      heldUnit: null,
    });

    expect(result).toMatchObject({
      input: {
        shoppingListItemId: 'line-eggs',
        amount: { measured: { quantity: 12, unitId: 'unit-pc' } },
        stock: false,
      },
    });
    expect(result).not.toHaveProperty('input.pantryItemId');
  });

  it('holds back a count a counted list line cannot read, to ask its amount', () => {
    // "EGGS 2 @ 4.20": two cartons, or two eggs? The API would count two eggs.
    expect(
      checkInLineOf({
        line: { index: 0, printed: 'EGGS' },
        choice: lineChoice({ itemId: 'item-eggs', quantity: 2, price: 8.4 }),
        ids: IDS,
        listLine: EGGS_LINE,
        heldUnit: null,
      }),
    ).toEqual({ needs: 'amount' });
  });

  it('marks a proposal the user replaced as edited', () => {
    const result = checkInLineOf({
      line: { index: 1, printed: 'AL FRESCO RED PEPP' },
      choice: lineChoice({ itemId: 'item-sausage', price: 6.49 }),
      ids: IDS,
      heldUnit: null,
      proposed: {
        itemId: 'item-pesto',
        method: ReceiptMatchMethod.Search,
        preselected: true,
      },
    });

    expect(result).toMatchObject({
      input: { resolvedBy: ReceiptMatchMethod.Search, edited: true },
    });
  });

  it('marks a suggestion the user picked as their choice, so the API learns it', () => {
    const result = checkInLineOf({
      line: { index: 1, printed: 'A-POTATO RUSSET ORG 3 LB' },
      choice: lineChoice({ itemId: 'item-potatoes', price: 3.99 }),
      ids: IDS,
      heldUnit: null,
      proposed: {
        itemId: 'item-potatoes',
        method: ReceiptMatchMethod.Search,
        preselected: false,
      },
    });

    expect(result).toMatchObject({
      input: { resolvedBy: ReceiptMatchMethod.Search, edited: true },
    });
  });

  it.each([
    ['item', lineChoice({ itemId: null, itemName: '  ', price: 1 })],
    ['unit', lineChoice({ itemId: 'item-1', quantity: 0.5, price: 1 })],
    ['price', lineChoice({ itemId: 'item-1', price: 0 })],
  ])('asks for the %s a line lacks', (needs, choice) => {
    expect(
      checkInLineOf({
        line: { index: 0, printed: 'X' },
        choice,
        ids: IDS,
        heldUnit: null,
      }),
    ).toEqual({ needs });
  });

  // IN-01: the spinach whose price went unread goes in at once, its cost
  // unknown: no total is stated, so the API observes no price and counts none.
  it('sends a line whose total went unread with no total, never zero', () => {
    const result = checkInLineOf({
      line: { index: 2, printed: 'SPINACH 10OZ' },
      choice: lineChoice({ itemId: 'item-spinach', price: null }),
      ids: IDS,
      heldUnit: null,
    });

    expect(result).toMatchObject({ input: { item: { id: 'item-spinach' } } });
    expect(result).not.toHaveProperty('input.totalPaid');
  });

  it('states a coupon on a line whose total went unread', () => {
    const result = checkInLineOf({
      line: MAYO,
      choice: lineChoice({ itemId: 'item-mayo', price: null }),
      ids: IDS,
      heldUnit: null,
    });

    expect(result).toMatchObject({ input: { discount: 1 } });
    expect(result).not.toHaveProperty('input.totalPaid');
  });

  // IN-04: the receipt for the 12 eggs already moved to the pantry fills in
  // that purchase: no stack, no list tick, no second purchase.
  it('sends the receipt for a picked earlier purchase as that purchase, stocking nothing', () => {
    const result = checkInLineOf({
      line: { index: 3, printed: 'EGGS LG 12CT' },
      choice: lineChoice({
        itemId: 'item-eggs',
        price: 4,
        notStocked: true,
        existingPurchase: { id: 'IN-04-existing-purchase', version: 3 },
      }),
      ids: IDS,
      listLine: EGGS_LINE,
      heldUnit: null,
    });

    expect(result).toMatchObject({
      input: {
        purchaseId: 'pur-1',
        stock: false,
        existingPurchase: { id: 'IN-04-existing-purchase', version: 3 },
        totalPaid: 4,
      },
    });
    expect(result).not.toHaveProperty('input.pantryItemId');
    expect(result).not.toHaveProperty('input.shoppingListItemId');
  });
});
