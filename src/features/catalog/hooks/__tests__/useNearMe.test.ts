import { act, renderHook } from '@testing-library/react-native';
import { requirePlatform } from '#/platform/install';
import { useNearMe } from '#features/catalog/hooks/useNearMe';

const port = () => requirePlatform('approximateLocation');

const pittsburgh = () =>
  jest
    .spyOn(port(), 'currentPlace')
    .mockResolvedValue({ lat: 40.440_625, lng: -79.995_886 });

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useNearMe', () => {
  it('asks nothing until the person wants stores near them', () => {
    const access = jest.spyOn(port(), 'access');
    const requestAccess = jest.spyOn(port(), 'requestAccess');

    const { result } = renderHook(() => useNearMe());

    expect(result.current.state).toBe('idle');
    expect(access).not.toHaveBeenCalled();
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('explains first, then the OS asks, then sends a place rounded to about a kilometre', async () => {
    jest.spyOn(port(), 'access').mockResolvedValue(null);
    const requestAccess = jest
      .spyOn(port(), 'requestAccess')
      .mockResolvedValue('granted');
    pittsburgh();
    const { result } = renderHook(() => useNearMe());

    await act(() => result.current.ask());
    expect(result.current.state).toBe('explaining');
    expect(requestAccess).not.toHaveBeenCalled();

    await act(() => result.current.allow());
    expect(result.current.state).toBe('located');
    expect(result.current.place).toEqual({ lat: 40.44, lng: -80 });
  });

  it('reads at once when location is already allowed', async () => {
    jest.spyOn(port(), 'access').mockResolvedValue('granted');
    pittsburgh();
    const { result } = renderHook(() => useNearMe());

    await act(() => result.current.ask());

    expect(result.current.state).toBe('located');
  });

  it('does not ask again during the visit once declined', async () => {
    const access = jest.spyOn(port(), 'access').mockResolvedValue(null);
    jest.spyOn(port(), 'requestAccess').mockResolvedValue('denied');
    const { result } = renderHook(() => useNearMe());

    await act(() => result.current.ask());
    await act(() => result.current.allow());
    expect(result.current.state).toBe('declined');

    await act(() => result.current.ask());
    expect(result.current.state).toBe('declined');
    expect(access).toHaveBeenCalledTimes(1);
  });

  it('points to Settings when location is off for the app', async () => {
    jest.spyOn(port(), 'access').mockResolvedValue('blocked');
    const openSettings = jest.spyOn(port(), 'openSettings');
    const { result } = renderHook(() => useNearMe());

    await act(() => result.current.ask());
    expect(result.current.state).toBe('blocked');

    result.current.openSettings();
    expect(openSettings).toHaveBeenCalled();
  });

  it('says so when the device cannot tell where it is', async () => {
    jest.spyOn(port(), 'access').mockResolvedValue('granted');
    jest.spyOn(port(), 'currentPlace').mockResolvedValue(null);
    const { result } = renderHook(() => useNearMe());

    await act(() => result.current.ask());

    expect(result.current.state).toBe('failed');
    expect(result.current.place).toBeNull();
  });
});
