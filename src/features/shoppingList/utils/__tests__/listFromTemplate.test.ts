import {
  listFromTemplate,
  type CopyableLine,
  type CopyableList,
} from '../listFromTemplate';

/**
 * The copy mirrors the server's `createFromTemplate`, read out of
 * `ShoppingListRepository.createFromTemplate`: settings plus every line,
 * whatever its purchase state, each landing unpurchased under a fresh id.
 */

let minted = 0;
const mintId = () => `line-${++minted}`;

const line = (over: Partial<CopyableLine> = {}): CopyableLine => ({
  id: 'src-1',
  itemName: 'Tomatoes',
  quantity: 2,
  quantityInput: '2',
  category: 'Produce',
  notes: 'ripe',
  unitName: 'pc',
  unitId: 'unit-1',
  itemId: 'item-1',
  sortOrder: 'a0',
  ...over,
});

const source = (over: Partial<CopyableList> = {}): CopyableList => ({
  id: 'template-1',
  name: 'Weekly Staples',
  description: 'Every week',
  budgetAmount: 40,
  tags: ['staples'],
  homeId: 'home-1',
  lines: [line()],
  ...over,
});

beforeEach(() => {
  minted = 0;
});

describe('listFromTemplate', () => {
  it('carries the settings the create input can express', () => {
    const { list } = listFromTemplate(source(), { name: 'Groceries', mintId });

    expect(list).toEqual({
      name: 'Groceries',
      description: 'Every week',
      budgetAmount: 40,
      tags: ['staples'],
      homeId: 'home-1',
    });
  });

  it('omits a setting the source does not carry rather than sending null', () => {
    const { list } = listFromTemplate(
      source({
        description: null,
        budgetAmount: null,
        tags: null,
        homeId: null,
      }),
      { name: 'Groceries', mintId },
    );

    expect(list).toEqual({ name: 'Groceries' });
  });

  it('mints one id per line', () => {
    const { items } = listFromTemplate(
      source({ lines: [line({ id: 'a' }), line({ id: 'b' })] }),
      { name: 'Groceries', mintId },
    );

    expect(items.map(i => i.id)).toEqual(['line-1', 'line-2']);
  });

  it('names a catalog line by its item id', () => {
    const { items } = listFromTemplate(source(), { name: 'G', mintId });

    expect(items[0]).toMatchObject({
      item: { itemId: 'item-1' },
      unit: { unitId: 'unit-1' },
      quantity: 2,
      notes: 'ripe',
      category: 'Produce',
      sortOrder: 'a0',
    });
  });

  it('falls back to the written name when the line has no catalog item', () => {
    const { items, skipped } = listFromTemplate(
      source({ lines: [line({ itemId: null, unitId: null })] }),
      { name: 'G', mintId },
    );

    expect(skipped).toEqual([]);
    expect(items[0]).toMatchObject({
      item: { itemName: 'Tomatoes' },
      unit: { unitName: 'pc' },
    });
  });

  it('reports a line naming neither an item nor a name rather than sending it blank', () => {
    const { items, skipped } = listFromTemplate(
      source({ lines: [line({ id: 'ghost', itemId: null, itemName: null })] }),
      { name: 'G', mintId },
    );

    expect(items).toEqual([]);
    expect(skipped).toEqual([
      { sourceId: 'ghost', reason: 'line-names-nothing' },
    ]);
  });

  it('completes for the lines it can copy when one cannot be expressed', () => {
    const { items, skipped } = listFromTemplate(
      source({
        lines: [
          line({ id: 'ok' }),
          line({ id: 'ghost', itemId: null, itemName: null }),
        ],
      }),
      { name: 'G', mintId },
    );

    expect(items).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });

  it('omits the unit entirely when the line names none', () => {
    const { items } = listFromTemplate(
      source({ lines: [line({ unitId: null, unitName: null })] }),
      { name: 'G', mintId },
    );

    expect(items[0]).not.toHaveProperty('unit');
  });

  it('omits a quantity the line does not carry, rather than defaulting to one', () => {
    const { items } = listFromTemplate(
      source({ lines: [line({ quantity: null })] }),
      { name: 'G', mintId },
    );

    expect(items[0]).not.toHaveProperty('quantity');
  });

  it('hands the caller what each copied row should render', () => {
    const { items, display } = listFromTemplate(source(), {
      name: 'G',
      mintId,
    });

    const id = items[0]?.id;
    expect(id).toBeDefined();
    expect(display.get(id!)).toEqual({
      itemName: 'Tomatoes',
      quantity: 2,
      quantityInput: '2',
      unitName: 'pc',
      category: 'Produce',
      itemId: 'item-1',
      unitId: 'unit-1',
    });
  });

  it('copies an empty template as an empty list rather than refusing', () => {
    const { list, items, skipped } = listFromTemplate(source({ lines: [] }), {
      name: 'Groceries',
      mintId,
    });

    expect(list.name).toBe('Groceries');
    expect(items).toEqual([]);
    expect(skipped).toEqual([]);
  });
});
