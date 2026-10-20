/**
 * Imperative modal alert, callable from outside the React tree. The host
 * registers a presenter: on mobile the native alert at startup, replaced by
 * AlertProvider's dialog once it mounts.
 */

import { logger } from '#/utils/environment';
import { t } from '#/i18n';
import type {
  AlertButton,
  AlertEntry,
  AlertPresenter,
} from '#platform/presenters';

class AlertService {
  private showAlertFn: AlertPresenter | null = null;
  private nextId = 1;

  /** The host's presenter; a later registration replaces an earlier one. */
  init(showAlert: AlertPresenter) {
    this.showAlertFn = showAlert;
  }

  /** No buttons means a single "OK". Without a presenter it is dropped. */
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const resolvedButtons: AlertButton[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: t('labels.ok'), style: 'default' }];

    if (!this.showAlertFn) {
      logger.warn('[AlertService] No alert presenter registered:', title);
      return;
    }

    const entry: AlertEntry = {
      id: this.nextId++,
      title,
      message,
      buttons: resolvedButtons,
    };

    this.showAlertFn(entry);
  }
}

export const alertService = new AlertService();
