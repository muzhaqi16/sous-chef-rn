import { makeQueuedMutation } from '#/test-utils/queuedMutation';
import { makeCache } from '#apollo/cache';
import { nameOfChange, nameOfRows } from '../changeName';

describe('the name a change not saved goes by', () => {
  it('is the row it changed', () => {
    expect(
      nameOfChange(
        makeQueuedMutation({
          pendingWrite: { id: 'w', inputs: { fields: { name: 'Milk' } } },
        }),
      ),
    ).toBe('Milk');
  });

  // A stock check refused for two stacks is listed under both.
  it('is each row of a change to several', () => {
    expect(
      nameOfChange(
        makeQueuedMutation({
          pendingWrite: {
            id: 'w',
            inputs: {
              rows: [
                { pantryItemId: 'eggs', itemName: 'Eggs' },
                { pantryItemId: 'milk', itemName: 'Milk' },
              ],
            },
          },
        }),
      ),
    ).toBe('Eggs, Milk');
  });

  it('is nothing where the change names nothing', () => {
    expect(nameOfChange(makeQueuedMutation({}))).toBeUndefined();
  });

  it('is the name it was given when made, over what its input says', () => {
    expect(
      nameOfChange(
        makeQueuedMutation({
          name: 'Heavy Cream',
          pendingWrite: { id: 'w', inputs: { fields: { name: 'Milk' } } },
        }),
      ),
    ).toBe('Heavy Cream');
  });
});

// A restock or a stock check names its rows by id alone.
describe('the rows a change names by id', () => {
  const cache = () => {
    const held = makeCache();
    held.restore({
      'PantryItem:cream': {
        __typename: 'PantryItem',
        id: 'cream',
        itemName: 'Heavy Cream',
      },
      'Home:home-1': { __typename: 'Home', id: 'home-1', name: 'Our flat' },
    });
    return held;
  };

  it('go by the names the device holds for them', () => {
    expect(nameOfRows(cache(), ['cream', 'home-1'])).toBe(
      'Heavy Cream, Our flat',
    );
  });

  it('go by nothing when the device holds none of them', () => {
    expect(nameOfRows(cache(), ['gone'])).toBeUndefined();
    expect(nameOfRows(cache(), [])).toBeUndefined();
  });
});
