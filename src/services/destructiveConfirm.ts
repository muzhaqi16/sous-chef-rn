import { t } from '#/i18n';
import type { AlertButton } from '#/services/alertService';

/** Cancel, then the destructive action, for an alert that asks before it runs. */
export function destructiveConfirm(
  label: string,
  onConfirm: () => void,
): AlertButton[] {
  return [
    { text: t('labels.cancel'), style: 'cancel' },
    { text: label, style: 'destructive', onPress: onConfirm },
  ];
}
