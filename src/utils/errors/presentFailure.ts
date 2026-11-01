import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { noteTrouble } from '#/services/toastService';
import { isVersionConflictCode } from './versionConflict';

/** What a settled failure shows: its code picks the buttons. */
interface PresentedFailure {
  code: string | null;
  title: string;
  body: string;
}

/** Alerts a failure; a version conflict offers `onConflictRefresh` as Refresh. */
export function presentFailure(
  failure: PresentedFailure,
  { onConflictRefresh }: { onConflictRefresh?: () => void } = {},
): void {
  if (isVersionConflictCode(failure.code) && onConflictRefresh) {
    // Still a failure, though it offers a choice.
    noteTrouble();
    alertService.alert(failure.title, failure.body, [
      { text: t('labels.refresh'), onPress: onConflictRefresh },
      { text: t('labels.cancel'), style: 'cancel' },
    ]);
    return;
  }
  alertService.alert(failure.title, failure.body);
}
