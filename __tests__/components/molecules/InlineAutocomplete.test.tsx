'use no memo';

import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { InlineAutocomplete } from '../../../src/components/molecules/InlineAutocomplete';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../src/components/atoms/Label', () => ({
  Label: ({ children }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText>{children}</RNText>;
  },
}));

describe('InlineAutocomplete', () => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
    items: [],
    renderItem: (item: any) => <Text>{item.name}</Text>,
    keyExtractor: (item: any) => item.id,
    onSelect: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<InlineAutocomplete {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders label when provided', () => {
    const { getByText } = render(
      <InlineAutocomplete {...defaultProps} label="Search items" />,
    );
    expect(getByText('Search items')).toBeTruthy();
  });

  it('renders placeholder in input', () => {
    const { getByPlaceholderText } = render(
      <InlineAutocomplete {...defaultProps} placeholder="Type to search..." />,
    );
    expect(getByPlaceholderText('Type to search...')).toBeTruthy();
  });

  it('renders error message when provided', () => {
    const { getByText } = render(
      <InlineAutocomplete {...defaultProps} error="Field is required" />,
    );
    expect(getByText('Field is required')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(
      <InlineAutocomplete {...defaultProps} testID="autocomplete" />,
    );
    expect(getByTestId('autocomplete')).toBeTruthy();
  });
});
