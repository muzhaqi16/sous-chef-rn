/**
 * Imperative modal alert with Alert.alert()'s signature, callable from outside
 * the React tree. AlertProvider bridges this singleton to the React tree.
 */

import { Alert } from 'react-native';
import { logger } from '#/utils/environment';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
}

export interface AlertEntry {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

type ShowAlertFn = (entry: AlertEntry) => void;

class AlertService {
  private showAlertFn: ShowAlertFn | null = null;
  private nextId = 1;

  /** Called once by AlertProvider on mount. */
  init(showAlert: ShowAlertFn) {
    this.showAlertFn = showAlert;
  }

  /** No buttons means a single "OK"; falls back to native Alert before the
   * provider mounts. */
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const resolvedButtons: AlertButton[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: 'OK', style: 'default' }];

    if (!this.showAlertFn) {
      // Fallback to native alert before provider mounts
      logger.warn(
        '[AlertService] Not initialized, falling back to native Alert.',
      );
      Alert.alert(
        title,
        message,
        resolvedButtons.map(b => ({
          text: b.text,
          style: b.style,
          onPress: b.onPress,
        })),
      );
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
