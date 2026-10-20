import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import { aisleAfter } from '../aisles';

describe('aisleAfter', () => {
  const walk = [
    StoreDepartment.Produce,
    StoreDepartment.Bakery,
    StoreDepartment.DairyEggs,
    StoreDepartment.Frozen,
  ];

  it('goes on to the next aisle on the walk that still holds lines', () => {
    expect(
      aisleAfter(walk, StoreDepartment.Bakery, [
        StoreDepartment.Produce,
        StoreDepartment.Frozen,
      ]),
    ).toBe(StoreDepartment.Frozen);
  });

  // An aisle skipped earlier on the walk is not lost behind the last one.
  it('shows every aisle once the walk has nothing further', () => {
    expect(
      aisleAfter(walk, StoreDepartment.Frozen, [StoreDepartment.Produce]),
    ).toBe('all');
  });
});
