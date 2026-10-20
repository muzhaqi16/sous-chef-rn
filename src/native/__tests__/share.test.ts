import { Platform, Share } from 'react-native';
import { shareUrl } from '../share';

const BASE = 'https://app.souschef.dev';

describe('shareUrl', () => {
  const shareSpy = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction });

  afterEach(() => {
    shareSpy.mockClear();
  });

  afterAll(() => {
    shareSpy.mockRestore();
  });

  it('passes url separately and message as text on iOS', async () => {
    Platform.OS = 'ios';
    await shareUrl(`${BASE}/join-home/ABC`, 'Join my home');
    expect(shareSpy).toHaveBeenCalledWith({
      url: `${BASE}/join-home/ABC`,
      message: 'Join my home',
    });
  });

  it('folds the url into message on Android', async () => {
    Platform.OS = 'android';
    await shareUrl(`${BASE}/join-home/ABC`, 'Join my home');
    expect(shareSpy).toHaveBeenCalledWith({
      message: `Join my home\n${BASE}/join-home/ABC`,
    });
  });

  it('swallows share-sheet errors instead of throwing', async () => {
    shareSpy.mockRejectedValueOnce(new Error('user dismissed'));
    await expect(shareUrl(`${BASE}/join-list/XYZ`)).resolves.toBeUndefined();
  });
});
