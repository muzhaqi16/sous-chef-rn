/**
 * Alert Service - Custom modal alert replacement for React Native's Alert.alert
 *
 * Provides an imperative API with the same signature as Alert.alert(),
 * callable from both React components and plain utility functions.
 * The AlertProvider bridges this singleton to the React tree.
 *
 * Usage:
 * ```typescript
 * import { alertService } from '#/services/alertService';
 *
 * // Simple info alert (default OK button)
 * alertService.alert('Success', 'Item added successfully');
 *
 * // Confirmation with buttons
 * alertService.alert('Delete Item', 'Are you sure?', [
 *   { text: 'Cancel', style: 'cancel' },
 *   { text: 'Delete', style: 'destructive', onPress: handleDelete },
 * ]);
 * ```
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

  /**
   * Initialize the alert service with the provider's show function.
   * Called once by AlertProvider on mount.
   */
  init(showAlert: ShowAlertFn) {
    this.showAlertFn = showAlert;
  }

  /**
   * Show a modal alert. Same signature as React Native's Alert.alert().
   *
   * When no buttons are provided, a single "OK" dismiss button is shown.
   * Falls back to native Alert.alert() if the provider isn't mounted yet.
   */
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
