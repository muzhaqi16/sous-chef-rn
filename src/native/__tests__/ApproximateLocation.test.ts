import { NativeModules } from 'react-native';
import { Telemetry } from '#/services/telemetry';
import { ApproximateLocation } from '../ApproximateLocation';

jest.mock('#/services/permissions/PermissionService', () => ({
  PermissionService: {},
}));

const nativeModules = NativeModules as Record<string, unknown>;

const readAnswers = (getCurrentPosition: jest.Mock) => {
  nativeModules.ApproximateLocationModule = { getCurrentPosition };
};

const failure = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

const warn = jest.mocked(Telemetry.warn);

afterEach(() => {
  delete nativeModules.ApproximateLocationModule;
  warn.mockClear();
});

describe('ApproximateLocation.currentPlace', () => {
  it('answers with the place read and logs nothing', async () => {
    readAnswers(jest.fn().mockResolvedValue({ lat: 40.44, lng: -79.9 }));

    await expect(ApproximateLocation.currentPlace()).resolves.toEqual({
      lat: 40.44,
      lng: -79.9,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs why a read failed and what it tried, with no place in it', async () => {
    readAnswers(
      jest.fn().mockRejectedValue(failure('location_timeout', 'Tried fused')),
    );

    await expect(ApproximateLocation.currentPlace()).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith('Location read failed', {
      reason: 'location_timeout',
      tried: 'Tried fused',
    });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toMatch(/lat|lng|longitude/i);
  });

  it('tells location switched off from a read that failed', async () => {
    readAnswers(
      jest
        .fn()
        .mockRejectedValue(failure('location_unavailable', 'Location is off')),
    );

    await expect(ApproximateLocation.currentPlace()).resolves.toBe('off');
  });

  it('cannot say where it is in a build without the module', async () => {
    await expect(ApproximateLocation.currentPlace()).resolves.toBeNull();
  });
});
