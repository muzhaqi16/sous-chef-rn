import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OfflineStatusPill } from '../OfflineStatusPill';
import { useOfflineStatus } from '#hooks/app/useOfflineStatus';

jest.mock('#hooks/app/useOfflineStatus');

const offlineStatus = useOfflineStatus as jest.MockedFunction<
  typeof useOfflineStatus
>;

const status = (over: Partial<ReturnType<typeof useOfflineStatus>> = {}) =>
  ({
    offline: true,
    iconName: 'cloud-offline-outline',
    message: 'You are offline',
    pendingCount: 0,
    ...over,
  } as ReturnType<typeof useOfflineStatus>);

describe('OfflineStatusPill', () => {
  it('renders nothing while online', () => {
    offlineStatus.mockReturnValue(status({ offline: false }));

    render(<OfflineStatusPill />);

    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('is a polite live region carrying the status as its label', () => {
    offlineStatus.mockReturnValue(status());

    render(<OfflineStatusPill />);

    const pill = screen.getByTestId('offline-banner');
    // Android reads the region on appearance. iOS is covered by the toast the
    // app root fires on the transition, not by a second announcement here —
    // two would read the same sentence twice.
    expect(pill.props.accessibilityLiveRegion).toBe('polite');
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
