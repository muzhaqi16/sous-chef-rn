import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { alertService } from '#/services/alertService';
import { destructiveConfirm } from '#/services/destructiveConfirm';

interface DiscardGuardOptions {
  /** The form holds input the user typed. */
  isDirty: boolean;
  /** Leaves the form, dropping its input. */
  onDiscard: () => void;
  /** Holds a sheet open against a pan-down while input would be lost. */
  onHoldOpen?: (held: boolean) => void;
}

const confirmDiscard = (translate: Translate, discard: () => void) =>
  alertService.alert(
    translate('confirmations.discardChangesTitle'),
    translate('confirmations.discardChanges'),
    destructiveConfirm(translate('labels.discard'), discard),
  );

/**
 * Typed input in a sheet is never dropped without asking, the way `FormScreen`
 * asks: returns the close for Cancel, which asks only while the form is dirty.
 */
export function useDiscardGuard({
  isDirty,
  onDiscard,
  onHoldOpen,
}: DiscardGuardOptions) {
  const { t } = useTranslation();

  useEffect(() => {
    onHoldOpen?.(isDirty);
    return () => onHoldOpen?.(false);
  }, [isDirty, onHoldOpen]);

  // Registered after the sheet's own Back handler, so it runs first.
  useEffect(() => {
    if (!isDirty) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        confirmDiscard(t, onDiscard);
        return true;
      },
    );
    return () => subscription.remove();
  }, [isDirty, onDiscard, t]);

  return () => (isDirty ? confirmDiscard(t, onDiscard) : onDiscard());
}
