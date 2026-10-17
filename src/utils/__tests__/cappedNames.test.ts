import { cappedNames } from '../cappedNames';

describe('cappedNames', () => {
  it.each([
    [['Milk'], undefined, { shown: 'Milk', remainder: 0 }],
    [
      ['Milk', 'Eggs', 'Rice'],
      undefined,
      { shown: 'Milk, Eggs, Rice', remainder: 0 },
    ],
    [
      ['Milk', 'Eggs', 'Rice', 'Oats'],
      undefined,
      { shown: 'Milk, Eggs, Rice', remainder: 1 },
    ],
    [['Milk'], 4, { shown: 'Milk', remainder: 3 }],
  ])('lists %j of %s as %j', (names, total, expected) => {
    expect(cappedNames(names, total)).toEqual(expected);
  });
});
