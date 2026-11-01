import { renderHook } from '@testing-library/react-native';
import { t } from '#/i18n';
import { useStore } from '#store';
import { useNoMatchCopy } from '../useNoMatchCopy';

describe('useNoMatchCopy', () => {
  afterEach(() => {
    useStore.setState({ isOnline: true, apiReachable: null });
  });

  it('says no results online', () => {
    const { result } = renderHook(() => useNoMatchCopy('kale'));

    expect(result.current).toEqual({
      heldOnly: false,
      title: t('empty.noResultsFor', { query: 'kale' }),
    });
  });

  it.each([
    ['no connection', { isOnline: false, apiReachable: null }],
    ['the API down on working Wi-Fi', { isOnline: true, apiReachable: false }],
  ])('says the wider search needs a connection with %s', (_cause, network) => {
    useStore.setState(network);

    const { result } = renderHook(() => useNoMatchCopy('kale'));

    expect(result.current).toEqual({
      heldOnly: true,
      title: t('empty.noHeldMatchFor', { query: 'kale' }),
      description: t('empty.widerSearchNeedsConnection'),
    });
  });

  it('says no results offline for a set the device holds whole', () => {
    useStore.setState({ isOnline: false, apiReachable: null });

    const { result } = renderHook(() => useNoMatchCopy('kale', true));

    expect(result.current.heldOnly).toBe(false);
  });
});
