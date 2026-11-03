import { NativeModules } from 'react-native';
import { Telemetry } from '#/services/telemetry';
import { ApproximateLocation, findPlace } from '../ApproximateLocation';

jest.mock('#/services/permissions/PermissionService', () => ({
  PermissionService: {},
}));

const nativeModules = NativeModules as Record<string, unknown>;

const PITTSBURGH = { lat: 40.44, lng: -79.9 };
const TEN_MINUTES = 10 * 60 * 1000;
const A_DAY = 24 * 60 * 60 * 1000;

const failure = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

/**
 * The module as both platforms answer: a held place no older than asked, one
 * reading at a time, and a cancel that gives that reading up as timed out.
 */
function device({
  held = {},
  reading,
}: {
  held?: { recent?: unknown; sameDay?: unknown; refused?: Error };
  reading?: Promise<unknown>;
}) {
  let giveUpReading: (error: Error) => void = () => {};
  const heldPosition = jest.fn((maxAge: number) => {
    if (held.refused) return Promise.reject(held.refused);
    return Promise.resolve(
      maxAge <= TEN_MINUTES ? held.recent ?? null : held.sameDay ?? null,
    );
  });
  const readPosition = jest.fn(
    () =>
      new Promise((resolve, reject) => {
        giveUpReading = reject;
        if (reading) reading.then(resolve, reject);
      }),
  );
  const cancelRead = jest.fn(() => {
    giveUpReading(failure('location_timeout', 'Tried Core Location'));
  });
  nativeModules.ApproximateLocationModule = {
    heldPosition,
    readPosition,
    cancelRead,
  };
  return { heldPosition, readPosition, cancelRead };
}

/** A deadline the test passes itself. */
function deadline() {
  let pass: () => void = () => {};
  const passed = new Promise<void>(resolve => {
    pass = resolve;
  });
  return { giveUp: () => passed, pass };
}

const warn = jest.mocked(Telemetry.warn);

afterEach(() => {
  delete nativeModules.ApproximateLocationModule;
  warn.mockClear();
});

describe('findPlace', () => {
  it('answers with a place held from the last ten minutes, without a reading', async () => {
    const { heldPosition, readPosition } = device({
      held: { recent: PITTSBURGH },
    });

    await expect(findPlace(deadline().giveUp)).resolves.toEqual(PITTSBURGH);

    expect(heldPosition).toHaveBeenCalledWith(TEN_MINUTES);
    expect(readPosition).not.toHaveBeenCalled();
  });

  it('answers with a new reading when nothing recent is held', async () => {
    const { cancelRead } = device({ reading: Promise.resolve(PITTSBURGH) });

    await expect(findPlace(deadline().giveUp)).resolves.toEqual(PITTSBURGH);

    expect(cancelRead).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('gives a slow reading up for a place held from the same day', async () => {
    const { heldPosition, cancelRead } = device({
      held: { sameDay: PITTSBURGH },
    });
    const { giveUp, pass } = deadline();

    const place = findPlace(giveUp);
    pass();

    await expect(place).resolves.toEqual(PITTSBURGH);
    expect(cancelRead).toHaveBeenCalledTimes(1);
    expect(heldPosition).toHaveBeenLastCalledWith(A_DAY);
    expect(warn).not.toHaveBeenCalled();
  });

  it('says it cannot tell, and logs the timeout with no place, when nothing answers', async () => {
    device({});
    const { giveUp, pass } = deadline();

    const place = findPlace(giveUp);
    pass();

    await expect(place).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('Location read failed', {
      reason: 'location_timeout',
      tried: 'Tried Core Location',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/lat|lng|longitude/i);
  });

  it('falls back to the same day when a reading fails outright', async () => {
    device({
      held: { sameDay: PITTSBURGH },
      reading: Promise.reject(failure('location_failed', 'Tried fused')),
    });

    await expect(findPlace(deadline().giveUp)).resolves.toEqual(PITTSBURGH);
  });

  it('tells location switched off from a read that failed', async () => {
    const { readPosition } = device({
      held: { refused: failure('location_unavailable', 'Location is off') },
    });

    await expect(findPlace(deadline().giveUp)).resolves.toBe('off');

    expect(readPosition).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Location read failed', {
      reason: 'location_unavailable',
      tried: 'Location is off',
    });
  });
});

describe('ApproximateLocation.currentPlace', () => {
  it('cannot say where it is in a build without the module', async () => {
    await expect(ApproximateLocation.currentPlace()).resolves.toBeNull();
  });
});
