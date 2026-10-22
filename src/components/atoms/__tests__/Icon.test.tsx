import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Icon } from '../Icon';

// The glyph is a private-use character: in a pressable with no label of its
// own, iOS would join it into the derived label ("<glyph>, At Giant-Eagle").
describe('Icon', () => {
  it.each([
    ['a colour', { color: '#123456' }],
    ['a tone', { tone: 'primary' as const }],
    ['the default colour', {}],
  ])('stays out of the accessibility tree with %s', (_label, props) => {
    render(<Icon name="storefront-outline" {...props} />);

    const [glyph] = screen.UNSAFE_root.findAll(
      node =>
        node.props.name === 'storefront-outline' &&
        typeof node.type === 'string',
    );
    expect(glyph?.props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });
});
