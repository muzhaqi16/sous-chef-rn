import { Platform, Share, type ShareContent } from 'react-native';
import { logger } from '#/utils/environment';

/**
 * iOS renders `url` as a rich preview, so text stays in `message` to avoid
 * showing the URL twice; Android ignores `url`, so it is folded into `message`.
 * Never throws, so a press handler can `void shareUrl(...)`.
 */
export async function shareUrl(url: string, message?: string): Promise<void> {
  const content: ShareContent =
    Platform.OS === 'ios'
      ? message
        ? { url, message }
        : { url }
      : { message: message ? `${message}\n${url}` : url };

  try {
    await Share.share(content);
  } catch (error) {
    logger.error('Failed to open share sheet', error);
  }
}
