'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { AnimatedButton } from '../../../src/components/atoms/AnimatedButton';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

describe('AnimatedButton', () => {
  it('renders children text', () => {
    const { getByText } = render(
      <AnimatedButton>Submit</AnimatedButton>,
    );
    expect(getByText('Submit')).toBeTruthy();
  });

  it('shows ActivityIndicator when loading', () => {
    const { queryByText } = render(
      <AnimatedButton loading>Submit</AnimatedButton>,
    );
    expect(queryByText('Submit')).toBeNull();
  });

  it('has correct accessibility role', () => {
    const { getByRole } = render(
      <AnimatedButton>Submit</AnimatedButton>,
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('renders with secondary variant', () => {
    const { getByText } = render(
      <AnimatedButton variant="secondary">Cancel</AnimatedButton>,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('renders with danger variant', () => {
    const { getByText } = render(
      <AnimatedButton variant="danger">Delete</AnimatedButton>,
    );
    expect(getByText('Delete')).toBeTruthy();
  });
});
