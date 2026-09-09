import React from 'react';
import { useTranslation } from '#/i18n';
import { Loading } from '#components/molecules/Loading';
import { ErrorState } from '#components/molecules/ErrorState';
import {
  EmptyState,
  type EmptyStateProps,
} from '#components/molecules/EmptyState';
import type { DataState } from '#hooks/data/useDataState';

interface DataStateViewProps {
  /** From `useDataState`. Renders nothing at `'ready'`. */
  state: DataState;
  /** Re-runs the query; offered on both the error and offline states. */
  onRetry: () => void;
  /**
   * The empty state is the screen's own — omit it and `'empty'` renders nothing
   * here, leaving the caller to draw it. The FAILURE states are never the
   * caller's to reimplement.
   */
  empty?: EmptyStateProps;
  testID?: string;
}

// Renders whichever of loading / error / offline / empty a screen is in. All four
// live here so a screen cannot implement three and stop — a hand-rolled version
// writes only the empty branch, and a failed fetch then reads "No recipes yet".
// The failure copy is the app's own everywhere: no server message, operation name
// or identifier reaches a person; the real error goes to the logs.
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
      // `warning`, not `info`: the offline pill and the offline toast are both
      // amber, and one condition reading blue on one screen and amber on the
      // next is the app disagreeing with itself.
      severity={offline ? 'warning' : 'error'}
      title={t(offline ? 'errors.notAvailableOffline' : 'dataState.errorTitle')}
      message={t(offline ? 'dataState.offlineBody' : 'dataState.errorBody')}
      onRetry={onRetry}
      retryLabel={t('labels.tryAgain')}
      alignment="center"
      // No `action`: after a failed fetch we don't know what exists, so offering
      // to create it invites a duplicate of something the person already owns.
      testID={testID ?? (offline ? 'state-offline' : 'state-error')}
    />
  );
};
