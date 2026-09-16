'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CardRightSlot } from '../CardRightSlot';

describe('CardRightSlot', () => {
  it('renders primary and secondary meta text', () => {
    render(<CardRightSlot primary="$4.99" secondary="per unit" />);
    expect(screen.getByText('$4.99')).toBeTruthy();
    expect(screen.getByText('per unit')).toBeTruthy();
  });

  it('puts the testID on the primary value', () => {
    render(<CardRightSlot primary="2 kg" testID="qty" />);
    expect(screen.getByTestId('qty')).toHaveTextContent('2 kg');
  });

  it('leaves an absent secondary slot empty', () => {
    render(<CardRightSlot primary="2 kg" />);
    expect(screen.queryByText('per unit')).toBeNull();
  });
});
