import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render } from '@testing-library/react-native';
import { OfflineTransitionAnnouncer } from '../OfflineTransitionAnnouncer';
import { useOfflineStatus } from '#hooks/ui/useOfflineStatus';
import { toastService } from '#/services/toastService';

jest.mock('#hooks/ui/useOfflineStatus');

const offlineStatus = useOfflineStatus as jest.MockedFunction<
  typeof useOfflineStatus
>;

const status = (
  offline: boolean,
  message = 'You are offline',
): ReturnType<typeof useOfflineStatus> => ({
  offline,
  iconName: 'cloud-offline-outline',
  message,
  pendingCount: 0,
});

describe('OfflineTransitionAnnouncer', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

  beforeEach(() => announce.mockClear());

  it('reads going offline and coming back, and shows no toast', () => {
    const toast = jest.spyOn(toastService, 'warning');
    offlineStatus.mockReturnValue(status(false));
    const { rerender } = render(<OfflineTransitionAnnouncer />);
    expect(announce).not.toHaveBeenCalled();

    offlineStatus.mockReturnValue(status(true));
    rerender(<OfflineTransitionAnnouncer />);
    expect(announce).toHaveBeenLastCalledWith('You are offline');

    offlineStatus.mockReturnValue(status(false));
    rerender(<OfflineTransitionAnnouncer />);
    expect(announce).toHaveBeenLastCalledWith(
      'Back online — syncing your changes',
    );
    expect(announce).toHaveBeenCalledTimes(2);
    expect(toast).not.toHaveBeenCalled();
    toast.mockRestore();
  });

  it('reads nothing more while the pending count ticks', () => {
    offlineStatus.mockReturnValue(status(true));
    const { rerender } = render(<OfflineTransitionAnnouncer />);

    offlineStatus.mockReturnValue(status(true, 'You are offline · 2 waiting'));
    rerender(<OfflineTransitionAnnouncer />);

    expect(announce).not.toHaveBeenCalled();
  });
});
