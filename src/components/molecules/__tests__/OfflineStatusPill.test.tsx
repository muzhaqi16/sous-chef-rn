import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OfflineStatusPill } from '../OfflineStatusPill';
import { useOfflineStatus } from '#hooks/ui/useOfflineStatus';

jest.mock('#hooks/ui/useOfflineStatus');

const offlineStatus = useOfflineStatus as jest.MockedFunction<
  typeof useOfflineStatus
>;

const status = (
  over: Partial<ReturnType<typeof useOfflineStatus>> = {},
): ReturnType<typeof useOfflineStatus> => ({
  offline: true,
  iconName: 'cloud-offline-outline',
  message: 'You are offline',
  pendingCount: 0,
  ...over,
});

describe('OfflineStatusPill', () => {
  it('renders nothing while online', () => {
    offlineStatus.mockReturnValue(status({ offline: false }));

    render(<OfflineStatusPill />);

    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('is a button carrying the status as its label', () => {
    offlineStatus.mockReturnValue(status());

    render(<OfflineStatusPill />);

    const pill = screen.getByTestId('offline-banner');
    // Not a live region: every mounted header has a pill, so each would read
    // the same sentence. The app root's announcer reads the transition once.
    expect(pill.props.accessibilityLiveRegion).toBeUndefined();
    expect(pill.props.accessibilityLabel).toBe('You are offline');
    expect(pill.props.accessibilityRole).toBe('button');
  });

  it('keeps the label in step with the pending count', () => {
    offlineStatus.mockReturnValue(
      status({ message: 'You are offline · 3 waiting', pendingCount: 3 }),
    );

    render(<OfflineStatusPill />);

    expect(screen.getByTestId('offline-banner').props.accessibilityLabel).toBe(
      'You are offline · 3 waiting',
    );
  });
});
