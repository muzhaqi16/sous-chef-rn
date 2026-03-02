'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { GreetingHeader } from '../../../../src/components/molecules/GreetingHeader/GreetingHeader';

jest.mock('../../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../../src/components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

describe('GreetingHeader', () => {
  it('renders greeting with user name', () => {
    const { getByText } = render(<GreetingHeader userName="John" />);
    expect(getByText('John')).toBeTruthy();
  });

  it('renders avatar initial from userName', () => {
    const { getByText } = render(<GreetingHeader userName="Alice" />);
    expect(getByText('A')).toBeTruthy();
  });

  it('renders search bar when search config provided', () => {
    const { getByTestId } = render(
      <GreetingHeader
        userName="John"
        search={{
          placeholder: 'Search...',
          value: '',
          onChangeText: jest.fn(),
        }}
      />,
    );
    expect(getByTestId('greeting-header-search')).toBeTruthy();
  });

  it('renders household badge when provided', () => {
    const { getByText } = render(
      <GreetingHeader
        userName="John"
        household={{ name: 'Smith Family' }}
      />,
    );
    expect(getByText('Smith Family')).toBeTruthy();
  });

  it('renders notification badge when count > 0', () => {
    const { getByText } = render(
      <GreetingHeader userName="John" notificationCount={3} />,
    );
    expect(getByText('3')).toBeTruthy();
  });
});
