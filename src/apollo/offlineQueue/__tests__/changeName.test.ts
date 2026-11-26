import { makeQueuedMutation } from '#/test-utils/queuedMutation';
import { nameOfChange } from '../changeName';

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
});
