import { accessibilityLabelOf } from '../accessibilityLabel';

describe('accessibilityLabelOf', () => {
  it('joins the parts in order, with the pause iOS puts between them', () => {
    expect(accessibilityLabelOf('Milk', '2 liters', '3 pcs')).toBe(
      'Milk, 2 liters, 3 pcs',
    );
  });

  it('skips a part that is absent, false or blank', () => {
    expect(
      accessibilityLabelOf('Milk', null, undefined, false, '', '  ', '1'),
    ).toBe('Milk, 1');
  });
});
