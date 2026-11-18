import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useStockCheck } from '../hooks/useStockCheck';
import { pantryTestIDs } from '../testIDs';
import { StockCheckSheet } from './StockCheckSheet';

/**
 * The pantry's way into a stock check: shown while the server has stacks worth
 * checking, never in the way of the list. Off with `pantryTrackingFoundation`.
 */
export const StockCheckEntry: React.FC = () => {
  const { t } = useTranslation();
  const enabled = useFeatureFlag('pantryTrackingFoundation');
  const { rows } = useStockCheck(enabled);
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      {rows.length > 0 ? (
        <AlertBanner
          variant="info"
          title={t('pantryScreen.stockCheckEntry', { count: rows.length })}
          onPress={() => setOpen(true)}
          testID={pantryTestIDs.stockCheckEntry}
        />
      ) : null}
      <StockCheckSheet visible={open} onDismiss={() => setOpen(false)} />
    </>
  );
};
