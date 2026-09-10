'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import type { AnimatedChip as AnimatedChipComponent } from '../../../src/components/molecules/AnimatedChip';
import { CuisineSelector } from '#features/profile/components/CuisineSelector';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/components/molecules/AnimatedChip', () => ({
  AnimatedChip: (props: React.ComponentProps<typeof AnimatedChipComponent>) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));

describe('CuisineSelector', () => {
  const defaultProps = {
    selectedCuisines: [],
    onAdd: jest.fn(async () => true),
    onRemove: jest.fn(),
  };

  it('renders without crashing', () => {
    const { getByText } = render(<CuisineSelector {...defaultProps} />);
    expect(getByText('Preferred Cuisines')).toBeTruthy();
  });

  it('shows subtitle text', () => {
    const { getByText } = render(<CuisineSelector {...defaultProps} />);
    expect(getByText('Select your favorite cuisines')).toBeTruthy();
  });

  it('shows Show All Cuisines button initially', () => {
    const { getByText } = render(<CuisineSelector {...defaultProps} />);
    expect(getByText('Show All Cuisines')).toBeTruthy();
  });

  it('renders cuisine chips', () => {
    const { toJSON } = render(<CuisineSelector {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });
});
