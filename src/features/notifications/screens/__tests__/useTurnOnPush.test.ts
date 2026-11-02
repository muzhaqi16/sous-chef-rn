import { act, renderHook } from '@testing-library/react-native';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { useTurnOnPush } from '../useTurnOnPush';

jest.mock('#/services/device/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));
const { registerDeviceInBackground } = jest.requireMock(
  '#/services/device/deviceRegistration',
);

const mockRequestPermissions = jest.fn();
jest.mock('../useNotificationPermissions', () => ({
  useNotificationPermissions: () => ({
    hasPermission: null,
    requestPermissions: mockRequestPermissions,
    checkPermissions: jest.fn(),
  }),
}));

const write = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(alertService, 'alert').mockImplementation(() => {});
  mockRequestPermissions.mockResolvedValue(true);
  write.mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

async function turnOn(
  alongside?: Parameters<ReturnType<typeof useTurnOnPush>['turnOnPush']>[0],
) {
  const { result } = renderHook(() => useTurnOnPush(write));
  let on = false;
  await act(async () => {
    on = await result.current.turnOnPush(alongside);
  });
  return on;
}

describe('useTurnOnPush', () => {
  it('asks the OS, writes push with what goes beside it, then delivers the token', async () => {
    const on = await turnOn({ expirationNotifications: true });

    expect(on).toBe(true);
    expect(mockRequestPermissions).toHaveBeenCalled();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({
      expirationNotifications: true,
      pushEnabled: true,
    });
    expect(registerDeviceInBackground).toHaveBeenCalled();
  });

  it('writes push alone when nothing goes beside it', async () => {
    await turnOn();

    expect(write).toHaveBeenCalledWith({ pushEnabled: true });
  });

  it('offers the system settings when the prompt is refused, writing nothing', async () => {
    mockRequestPermissions.mockResolvedValue(false);

    const on = await turnOn({ expirationNotifications: true });

    expect(on).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(registerDeviceInBackground).not.toHaveBeenCalled();
    expect(alertService.alert).toHaveBeenCalledWith(
      t('notifications.permissionRequiredTitle'),
      t('notifications.permissionRequiredMessage'),
      expect.arrayContaining([
        expect.objectContaining({ text: t('labels.openSettings') }),
      ]),
    );
  });

  it('says so when the write is refused, and registers nothing', async () => {
    write.mockResolvedValue(false);

    const on = await turnOn();

    expect(on).toBe(false);
    expect(registerDeviceInBackground).not.toHaveBeenCalled();
    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('notifications.updateFailed'),
    );
  });
});
