import React from 'react';
import { useTranslation } from '#/i18n';
import { Loading } from './Loading';
import { ErrorState } from './ErrorState';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import type { DataState } from '#hooks/data/useDataState';

interface DataStateViewProps {
  /** From `useDataState`. Renders nothing at `'ready'`. */
  state: DataState;
  /**
   * Re-runs the query. Offered on both the error and offline states — the point
   * of those states is that they are recoverable without leaving the screen.
   */
  onRetry: () => void;
  /**
   * The empty state, which is the screen's own: only it knows what "nothing
   * here" means or what to do about it. Everything else is shared vocabulary.
   *
   * Optional, for screens with a bespoke empty state of their own — omitting it
   * makes `'empty'` render nothing here, and the caller renders it instead. The
   * failure states are never the caller's to reimplement.
   */
  empty?: EmptyStateProps;
  testID?: string;
}

/**
 * Renders whichever of loading / error / offline / empty a screen is in.
 *
 * Every screen used to hand-roll this, and most of them only ever wrote the
 * empty branch — so a failed fetch rendered "No recipes yet" alongside a button
 * offering to create the recipes the person already owns. The four states are
 * kept in one place so that a screen cannot implement three of them and stop.
 *
 * The failure text is deliberately the app's own and identical everywhere: the
 * same situation reads the same on every screen, and no server message,
 * operation name or identifier reaches a person. The real error goes to the logs
 * through the query's own reporting.
 */
export const DataStateView: React.FC<DataStateViewProps> = ({
  state,
  onRetry,
  empty,
  testID,
}) => {
  const { t } = useTranslation();

  if (state === 'ready') return null;

  if (state === 'loading') {
    return (
      <Loading
        message={t('dataState.loading')}
        testID={testID ?? 'state-loading'}
      />
    );
  }

  if (state === 'empty') {
    if (!empty) return null;
    return <EmptyState {...empty} testID={empty.testID ?? testID} />;
  }

  const offline = state === 'offline';
  return (
    <ErrorState
      icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
      severity={offline ? 'info' : 'error'}
      title={t(offline ? 'dataState.offlineTitle' : 'dataState.errorTitle')}
      message={t(offline ? 'dataState.offlineBody' : 'dataState.errorBody')}
      onRetry={onRetry}
      retryLabel={t('dataState.retry')}
      alignment="center"
      // No `action` to create anything: when the fetch failed we do not know
      // what exists, so offering to create it invites a duplicate of something
      // the person may already own.
      testID={testID ?? (offline ? 'state-offline' : 'state-error')}
    />
  );
};
