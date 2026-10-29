import { requirePlatform } from '#platform/install';
import { changeLanguage, deviceAppLanguage, getResolvedLanguage } from '#/i18n';
import { useStore } from '#store';
import { logger } from '#/utils/environment';

/**
 * A user who never picked a language takes the device's again on each return
 * to the foreground: Android keeps the app running through a change of the
 * device's or the app's language in Settings, where iOS restarts it.
 */
export function followDeviceLanguage(): () => void {
  return requirePlatform('appLifecycle').subscribe(state => {
    if (state !== 'active' || useStore.getState().language) return;
    const language = deviceAppLanguage();
    if (language === getResolvedLanguage()) return;
    changeLanguage(language).catch((error: unknown) =>
      logger.warn('Following the device language failed', error),
    );
  });
}
