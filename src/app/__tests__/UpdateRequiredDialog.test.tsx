import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { appConfig } from '#/config/appConfig';
import { UpdateRequiredDialog } from '../UpdateRequiredDialog';

let mockRequired = false;
const mockOpenWebUrl = jest.fn<Promise<boolean>, [string]>();

jest.mock('#store/useAppStore', () => ({
  useIsClientUpgradeRequired: () => mockRequired,
}));
jest.mock('#native/externalUrl', () => ({
  openWebUrl: (url: string) => mockOpenWebUrl(url),
}));

const { isWebUrl } = jest.requireActual<typeof import('#native/externalUrl')>(
  '#native/externalUrl',
);

describe('UpdateRequiredDialog', () => {
  beforeEach(() => {
    mockRequired = false;
    mockOpenWebUrl.mockReset().mockResolvedValue(true);
  });

  it('shows nothing while the server accepts this build', () => {
    render(<UpdateRequiredDialog />);

    expect(screen.queryByText('Update Required')).toBeNull();
  });

  it('asks for the update once the server refuses this build', () => {
    mockRequired = true;

    render(<UpdateRequiredDialog />);

    expect(screen.getByText('Update Required')).toBeTruthy();
    expect(
      screen.getByText(/can no longer connect to the server/),
    ).toBeTruthy();
  });

  it("opens this platform's store listing and stays up", async () => {
    mockRequired = true;
    const user = userEvent.setup();
    render(<UpdateRequiredDialog />);

    await user.press(screen.getByText('Update'));

    // The jest preset's platform is iOS.
    expect(mockOpenWebUrl).toHaveBeenCalledWith(
      appConfig.identity.storeListings.ios,
    );
    expect(screen.getByText('Update Required')).toBeTruthy();
  });

  // `openWebUrl` refuses anything but http(s), so an `itms-apps:` or `market:`
  // listing would leave the button doing nothing.
  it('lists every store as a web page', () => {
    const { ios, android } = appConfig.identity.storeListings;

    expect(isWebUrl(ios)).toBe(true);
    expect(isWebUrl(android)).toBe(true);
  });
});
