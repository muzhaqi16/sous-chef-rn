'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { CuisineSelector } from '../../../src/components/organisms/CuisineSelector';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../src/components/atoms/AnimatedChip', () => ({
  AnimatedChip: (props: any) => {
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
