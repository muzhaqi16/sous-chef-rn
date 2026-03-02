import React from 'react';
import { render } from '@testing-library/react-native';
import { Divider } from '../Divider';

describe('Divider', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<Divider />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders as a View element', () => {
    const tree = render(<Divider />).toJSON();
    expect(tree).toBeTruthy();
    expect((tree as any)!.type).toBe('View');
  });
});
