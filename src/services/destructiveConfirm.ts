import { t } from '#i18n';
import type { AlertButton } from '#platform/presenters';
import { alertService } from '#services/alertService';

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

/** Asks before closing a form or sheet throws away what was typed. */
export function confirmDiscardChanges(onDiscard: () => void): void {
  alertService.alert(
    t('confirmations.discardChangesTitle'),
    t('confirmations.discardChanges'),
    destructiveConfirm(t('labels.discard'), onDiscard),
  );
}
