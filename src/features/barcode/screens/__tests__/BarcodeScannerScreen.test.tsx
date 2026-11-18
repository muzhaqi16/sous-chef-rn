import React from 'react';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { t } from '#/i18n';
import { PermissionService } from '#/services/permissions/PermissionService';
import { HapticService } from '#services/haptic/HapticService';
import type { BarcodeSource } from '#features/barcode/types';
import { BarcodeScannerScreen } from '../BarcodeScannerScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

interface CameraProps {
  isActive?: boolean;
  torchMode?: 'on' | 'off';
  onStarted?: () => void;
  onStopped?: () => void;
}

/** The native camera: the props the screen last gave it, and its devices. */
const mockCamera: { props: CameraProps; devices: { position: string }[] } = {
  props: {},
  devices: [{ position: 'back' }],
};
jest.mock('react-native-vision-camera', () => ({
  Camera: (props: CameraProps) => {
    mockCamera.props = props;
    return null;
  },
  useCameraDevices: () => mockCamera.devices,
}));

/** The native code scanner: what the screen hands it to call on a read. */
const mockScanner: {
  onBarcodeScanned?: (code: { value: string; format: string }) => void;
} = {};
jest.mock('../useBarcodeOutput', () => ({
  useBarcodeOutput: (options: {
    onBarcodeScanned: (code: { value: string; format: string }) => void;
  }) => {
    mockScanner.onBarcodeScanned = options.onBarcodeScanned;
    return {};
  },
}));

// The library's focus effect runs on every render; this one runs when told,
// as a screen gaining focus does.
const mockFocus: React.EffectCallback[] = [];
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (effect: React.EffectCallback) => {
    mockFocus.push(effect);
  },
}));

type PermissionStatus = Awaited<ReturnType<typeof PermissionService.check>>;

const SOURCE: BarcodeSource = 'pantry';

/**
 * Opens the scanner with the camera permission `held`, focuses it, and, for a
 * permission not yet granted, waits for the ask once the screen settles.
 */
async function openScanner({
  held = 'granted',
  askAnswers = 'denied',
}: { held?: PermissionStatus; askAnswers?: PermissionStatus } = {}) {
  jest.spyOn(PermissionService, 'check').mockResolvedValue(held);
  const asked = new Promise<void>(resolve => {
    jest.spyOn(PermissionService, 'request').mockImplementation(async () => {
      resolve();
      return askAnswers;
    });
  });
  render(
    <BarcodeScannerScreen
      route={{ params: { source: SOURCE, pantryId: 'p-1' } }}
    />,
  );
  await act(async () => {
    mockFocus.splice(0).forEach(effect => effect());
  });
  if (held !== 'granted' && held !== 'blocked') {
    // Outside `act`: the settle timer's render, which sends the ask, would wait
    // on a held scope.
    await asked;
    await act(async () => undefined);
  }
}

/** The focus effects of the latest render, run as a refocus would. */
const refocus = async () => {
  await act(async () => {
    mockFocus.splice(0).forEach(effect => effect());
  });
};

const scan = (value: string, format = 'ean-13') => {
  act(() => {
    mockScanner.onBarcodeScanned?.({ value, format });
  });
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockFocus.length = 0;
  mockCamera.devices = [{ position: 'back' }];
  mockCamera.props = {};
});

describe('the camera permission', () => {
  it('is asked for once the screen settles, with no refusal said before', async () => {
    jest.spyOn(PermissionService, 'check').mockResolvedValue('denied');
    jest
      .spyOn(PermissionService, 'request')
      .mockImplementation(() => new Promise(() => undefined));
    render(<BarcodeScannerScreen route={{ params: { source: SOURCE } }} />);
    await act(async () => undefined);

    expect(
      screen.queryByText(t('errors.cameraPermission')),
    ).not.toBeOnTheScreen();
    expect(PermissionService.request).not.toHaveBeenCalled();
  });

  it('offers to ask again once the ask was refused, and a way out', async () => {
    await openScanner({ held: 'denied' });

    expect(screen.getByText(t('errors.cameraPermission'))).toBeTruthy();
    expect(screen.getByText(t('labels.grantPermission'))).toBeTruthy();
    await userEvent.setup().press(screen.getByText(t('labels.cancel')));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('sends a blocked camera to Settings without asking', async () => {
    const settings = jest
      .spyOn(PermissionService, 'openSettings')
      .mockResolvedValue(undefined);
    await openScanner({ held: 'blocked' });

    expect(PermissionService.request).not.toHaveBeenCalled();
    await userEvent.setup().press(screen.getByText(t('labels.openSettings')));
    expect(settings).toHaveBeenCalledTimes(1);
  });
});

describe('the scanner', () => {
  it('says so when the device has no camera', async () => {
    mockCamera.devices = [];
    await openScanner();

    expect(screen.getByText(t('errors.noCameraDevice'))).toBeTruthy();
  });

  it('wakes the camera on focus', async () => {
    await openScanner();
    await refocus();

    expect(mockCamera.props.isActive).toBe(true);
  });

  it('opens what it reads, once, carrying where it was opened from', async () => {
    const felt = jest.spyOn(HapticService, 'success');
    await openScanner();
    await refocus();

    scan('051500255162');
    scan('000000000000');

    expect(mockNav.toSearchResults).toHaveBeenCalledTimes(1);
    expect(mockNav.toSearchResults).toHaveBeenCalledWith({
      barcode: '051500255162',
      format: 'ean-13',
      source: SOURCE,
      pantryId: 'p-1',
      shoppingListId: undefined,
    });
    expect(felt).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t('status.barcodeScanned'))).toBeTruthy();
  });

  it('scans again on request', async () => {
    await openScanner();
    await refocus();
    scan('051500255162');

    await userEvent.setup().press(screen.getByText(t('labels.scanAnother')));
    scan('000000000017');

    expect(mockNav.toSearchResults).toHaveBeenCalledTimes(2);
  });

  it('closes to the navigator above it, where there is one', async () => {
    const parent = { canGoBack: () => true, goBack: jest.fn() };
    jest.mocked(mockNav.navigation.getParent).mockReturnValueOnce(parent);
    await openScanner();

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('barcodeScanner.closeScanner')));

    expect(parent.goBack).toHaveBeenCalledTimes(1);
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });
});

describe('the torch', () => {
  const flash = (on: boolean) =>
    screen.getByLabelText(
      on ? t('barcodeScanner.flashOff') : t('barcodeScanner.flashOn'),
    );

  it('commands nothing until the session starts, then what was pressed', async () => {
    await openScanner();

    await userEvent.setup().press(flash(false));
    expect(mockCamera.props.torchMode).toBeUndefined();
    act(() => {
      mockCamera.props.onStarted?.();
    });

    expect(mockCamera.props.torchMode).toBe('on');
  });

  it('turns off again', async () => {
    await openScanner();
    act(() => {
      mockCamera.props.onStarted?.();
    });
    const user = userEvent.setup();

    await user.press(flash(false));
    await user.press(flash(true));

    expect(mockCamera.props.torchMode).toBe('off');
  });

  it('is left dark once the session stops', async () => {
    await openScanner();
    act(() => {
      mockCamera.props.onStarted?.();
    });
    await userEvent.setup().press(flash(false));

    act(() => {
      mockCamera.props.onStopped?.();
      mockCamera.props.onStarted?.();
    });

    expect(mockCamera.props.torchMode).toBeUndefined();
  });
});
