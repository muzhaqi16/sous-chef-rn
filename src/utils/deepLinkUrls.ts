import { Platform, Share } from 'react-native';
import type { ShareContent } from 'react-native';
import { appConfig } from '#/config/appConfig';
import { logger } from '#/utils/environment';

/**
 * Builders for shareable universal-link URLs and a thin wrapper around the OS
 * share sheet.
 *
 * The base host is derived from `appConfig.identity.deepLink.hosts` so there is
 * a single source of truth — the same host that `RootNavigator`'s
 * `DEEP_LINK_PREFIXES` registers with React Navigation, and the same shapes the
 * API's `ShareLink.universal` produces (`join-home/:joinCode`,
 * `join-list/:shareCode`). A link produced here resolves back to the matching
 * screen when opened.
 *
 * Prefer the `https://app.souschef.dev/...` form over the `souschef://` custom
 * scheme for anything user-facing: universal/app links open the app when it's
 * installed and fall back to the web otherwise, whereas the custom scheme dead-
 * ends for recipients who don't have the app.
 */

const WEB_BASE_URL = `https://${appConfig.identity.deepLink.hosts[0]}`;

/** `https://app.souschef.dev/join-home/{joinCode}` — anyone-with-link home join. */
export const buildJoinHomeUrl = (joinCode: string): string =>
  `${WEB_BASE_URL}/join-home/${encodeURIComponent(joinCode)}`;

/** `https://app.souschef.dev/join-list/{shareCode}` — anyone-with-link list join. */
export const buildJoinListUrl = (shareCode: string): string =>
  `${WEB_BASE_URL}/join-list/${encodeURIComponent(shareCode)}`;

/**
 * Open the OS share sheet with a link.
 *
 * iOS renders the `url` field as a rich link preview, so the descriptive text
 * goes in `message` and the URL stays separate to avoid showing it twice.
 * Android ignores `url`, so the URL is folded into `message` there.
 *
 * Resolves quietly on user cancellation; real failures are logged rather than
 * thrown so callers can `void shareUrl(...)` from a press handler.
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
