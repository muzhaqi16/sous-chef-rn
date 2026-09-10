import { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { advanceRecurringDate, nextRecurringList } from '../nextRecurringList';
import type { CopyableList } from '../listFromTemplate';

/**
 * The roll mirrors `ShoppingListService.generateNextRecurringList`: the same
 * copy `listFromTemplate` makes, plus where the schedule pointer moves to.
 */

const NOW = new Date('2026-03-10T09:00:00.000Z');

const source: CopyableList = {
  id: 'list-1',
  name: 'Weekly Shop',
  description: null,
  budgetAmount: null,
  tags: null,
  homeId: 'home-1',
  lines: [
    {
      id: 'src-1',
      itemName: 'Tomatoes',
      quantity: 2,
      unitId: 'unit-1',
      itemId: 'item-1',
    },
  ],
};

describe('advanceRecurringDate', () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  it('carries a daily pattern one day per interval', () => {
    expect(iso(advanceRecurringDate(RecurringPattern.Daily, 3, NOW))).toBe(
      '2026-03-13',
    );
  });

  it('carries a weekly pattern seven days per interval', () => {
    expect(iso(advanceRecurringDate(RecurringPattern.Weekly, 1, NOW))).toBe(
      '2026-03-17',
    );
  });

  it('carries a biweekly pattern fourteen days per interval', () => {
    expect(iso(advanceRecurringDate(RecurringPattern.Biweekly, 1, NOW))).toBe(
      '2026-03-24',
    );
  });

  it('carries a monthly pattern by calendar months', () => {
    expect(iso(advanceRecurringDate(RecurringPattern.Monthly, 2, NOW))).toBe(
      '2026-05-10',
    );
  });

  it('counts a custom interval in days, as the server does', () => {
    expect(iso(advanceRecurringDate(RecurringPattern.Custom, 5, NOW))).toBe(
      '2026-03-15',
    );
  });

  it('counts days when the list names no pattern', () => {
    expect(iso(advanceRecurringDate(null, 2, NOW))).toBe('2026-03-12');
  });

  it('leaves the date where it is on a zero interval', () => {
    expect(iso(advanceRecurringDate(RecurringPattern.Weekly, 0, NOW))).toBe(
      '2026-03-10',
    );
  });

  it('does not mutate the date it is given', () => {
    const from = new Date(NOW);
    advanceRecurringDate(RecurringPattern.Weekly, 1, from);
    expect(from.toISOString()).toBe(NOW.toISOString());
  });
});

describe('nextRecurringList', () => {
  let minted = 0;
  const mintId = () => `line-${++minted}`;
  beforeEach(() => {
    minted = 0;
  });

  it('copies the list and advances the pointer by one interval', () => {
    const derived = nextRecurringList(source, {
      pattern: RecurringPattern.Weekly,
      interval: 1,
      name: 'Weekly Shop - Mar 10',
      now: NOW,
      mintId,
    });

    expect(derived.list).toEqual({
      name: 'Weekly Shop - Mar 10',
      homeId: 'home-1',
    });
    expect(derived.items).toHaveLength(1);
    expect(derived.items[0]).toMatchObject({
      id: 'line-1',
      item: { itemId: 'item-1' },
    });
    expect(derived.nextRecurringDate).toBe('2026-03-17T09:00:00.000Z');
  });

  it('treats a missing interval as zero, as the server does', () => {
    const derived = nextRecurringList(source, {
      pattern: RecurringPattern.Weekly,
      interval: null,
      name: 'Weekly Shop',
      now: NOW,
      mintId,
    });

    expect(derived.nextRecurringDate).toBe(NOW.toISOString());
  });
});
