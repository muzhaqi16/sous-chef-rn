'use no memo';
import React from 'react';
import { render } from '@testing-library/react-native';
import { ShoppingEmptyIllustration } from '#features/shoppingList/components/ShoppingEmptyIllustration';

describe('ShoppingEmptyIllustration', () => {
  it('renders without crashing with default size', () => {
    const { toJSON } = render(<ShoppingEmptyIllustration />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders small variant', () => {
    const { toJSON } = render(<ShoppingEmptyIllustration size="small" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders medium variant', () => {
    const { toJSON } = render(<ShoppingEmptyIllustration size="medium" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders large variant', () => {
    const { toJSON } = render(<ShoppingEmptyIllustration size="large" />);
    expect(toJSON()).toBeTruthy();
  });
});
