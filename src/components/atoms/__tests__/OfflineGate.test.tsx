'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { OfflineGate } from '../OfflineGate';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText>{name}</RNText>;
  },
}));

const mockUseIsEffectivelyOffline = jest.fn(() => false);
jest.mock('#hooks/settings/useOfflineMode', () => ({
  useIsEffectivelyOffline: () => mockUseIsEffectivelyOffline(),
}));

describe('OfflineGate', () => {
  beforeEach(() => {
    mockUseIsEffectivelyOffline.mockReturnValue(false);
  });

  it('renders children when online', () => {
    render(
      <OfflineGate>
        <Text>Online Content</Text>
      </OfflineGate>,
    );
    expect(screen.getByText('Online Content')).toBeTruthy();
  });

  it('shows offline message when offline in replace mode', () => {
    mockUseIsEffectivelyOffline.mockReturnValue(true);
    render(
      <OfflineGate message="Custom offline message">
        <Text>Online Content</Text>
      </OfflineGate>,
    );
    expect(screen.getByText('Custom offline message')).toBeTruthy();
    expect(screen.queryByText('Online Content')).toBeNull();
  });

  it('renders nothing when offline in hide mode', () => {
    mockUseIsEffectivelyOffline.mockReturnValue(true);
    const { toJSON } = render(
      <OfflineGate mode="hide">
        <Text>Online Content</Text>
      </OfflineGate>,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders compact layout when compact prop is true', () => {
    mockUseIsEffectivelyOffline.mockReturnValue(true);
    render(
      <OfflineGate compact message="Search unavailable">
        <Text>Online Content</Text>
      </OfflineGate>,
    );
    expect(screen.getByText('Search unavailable')).toBeTruthy();
  });
});
