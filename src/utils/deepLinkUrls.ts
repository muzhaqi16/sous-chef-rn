import { Platform, Share } from 'react-native';
import type { ShareContent } from 'react-native';
import { appConfig } from '#/config/appConfig';
import { logger } from '#/utils/environment';

/**
 * Shareable universal-link builders. The host comes from
 * `appConfig.identity.deepLink.hosts` (the one `RootNavigator` registers) and
 * the shapes match the API's `ShareLink.universal`. Prefer this https form to
 * `souschef://`, which dead-ends for a recipient without the app.
 */

const WEB_BASE_URL = `https://${appConfig.identity.deepLink.hosts[0]}`;

/** `https://app.souschef.dev/join-home/{joinCode}` — anyone-with-link home join. */
export const buildJoinHomeUrl = (joinCode: string): string =>
  `${WEB_BASE_URL}/join-home/${encodeURIComponent(joinCode)}`;

/** `https://app.souschef.dev/join-list/{shareCode}` — anyone-with-link list join. */
export const buildJoinListUrl = (shareCode: string): string =>
  `${WEB_BASE_URL}/join-list/${encodeURIComponent(shareCode)}`;

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
