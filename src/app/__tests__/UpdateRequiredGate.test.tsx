import React from 'react';
import { AccessibilityInfo, BackHandler } from 'react-native';
import {
  isHiddenFromAccessibility,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { Modal } from '#components/atoms/themedComponents';
import { appConfig } from '#/config/appConfig';
import { UpdateRequiredGate } from '../UpdateRequiredGate';
import { drainTimers } from '#/test-utils/drainTimers';

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

const renderGate = () =>
  render(
    <UpdateRequiredGate>
      <Text>Pantry</Text>
    </UpdateRequiredGate>,
  );

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('UpdateRequiredGate', () => {
  beforeEach(() => {
    mockRequired = false;
    mockOpenWebUrl.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the app alone while the server accepts this build', () => {
    renderGate();

    expect(screen.queryByText('Update Required')).toBeNull();
    expect(isHiddenFromAccessibility(screen.getByText('Pantry'))).toBe(false);
  });

  it('asks for the update once the server refuses this build', () => {
    mockRequired = true;

    renderGate();

    expect(screen.getByText('Update Required')).toBeTruthy();
    expect(
      screen.getByText(/can no longer connect to the server/),
    ).toBeTruthy();
  });

  // iOS refuses a native Modal while a screen or alert is presented, and RN
  // never asks again, so the blocker must not be one.
  it('draws over the app in the tree, never in a native Modal', () => {
    mockRequired = true;

    renderGate();

    expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
  });

  it('hides the app it covers from screen readers and focuses the dialog', () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    mockRequired = true;

    renderGate();

    expect(
      isHiddenFromAccessibility(
        screen.getByText('Pantry', { includeHiddenElements: true }),
      ),
    ).toBe(true);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
  });

  it('keeps Android back from reaching the app under it', () => {
    let onBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        onBack = handler;
        return { remove: jest.fn() };
      });
    mockRequired = true;

    renderGate();

    expect(onBack?.({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);
    expect(screen.getByText('Update Required')).toBeTruthy();
  });

  it("opens this platform's store listing and stays up", async () => {
    mockRequired = true;
    const user = userEvent.setup();
    renderGate();

    await user.press(screen.getByText('Update'));

    // The jest preset's platform is iOS.
    expect(mockOpenWebUrl).toHaveBeenCalledWith(
      appConfig.identity.storeListings.ios,
    );
    expect(screen.getByText('Update Required')).toBeTruthy();
    expect(screen.queryByText(/The store didn't open/)).toBeNull();
  });

  // The dialog cannot be closed, so a tap that does nothing would trap the user.
  it('says so when the store does not open', async () => {
    mockRequired = true;
    mockOpenWebUrl.mockResolvedValue(false);
    const user = userEvent.setup();
    renderGate();

    await user.press(screen.getByText('Update'));

    await drainTimers();
    expect(screen.getByText(/The store didn't open/)).toBeTruthy();
  });

  // `openWebUrl` refuses anything but http(s), so an `itms-apps:` or `market:`
  // listing would leave the button doing nothing.
  it('lists every store as a web page', () => {
    const { ios, android } = appConfig.identity.storeListings;

    expect(isWebUrl(ios)).toBe(true);
    expect(isWebUrl(android)).toBe(true);
  });
});
