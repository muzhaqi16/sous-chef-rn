import { useState } from 'react';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { Telemetry } from '#/services/telemetry';

export interface UseAddItemSheetOptions {
  currentListId: string | undefined;
  onNavigateToListSettings?: () => void;
}

export interface UseAddItemSheetResult {
  visible: boolean;
  /** The step the sheet opens on: its search, or its form for "Add manually". */
  startStep: 'search' | 'details';
  /** Opens only once a list is selected; otherwise offers to create one. */
  open: () => void;
  /** As `open`, on the details form. */
  openManually: () => void;
  close: () => void;
}

export function useAddItemSheet(
  options: UseAddItemSheetOptions,
): UseAddItemSheetResult {
  const { currentListId, onNavigateToListSettings } = options;

  const [visible, setVisible] = useState(false);
  const [startStep, setStartStep] = useState<'search' | 'details'>('search');

  const openOn = (step: 'search' | 'details') => {
    if (!currentListId) {
      Telemetry.trackEvent('add_item_no_list_selected');
      alertService.alert(
        t('addItemSheet.noListTitle'),
        t('addItemSheet.noListBody'),
        [
          { text: t('labels.cancel'), style: 'cancel' },
          {
            text: t('addItemSheet.createList'),
            onPress: () => {
              Telemetry.trackEvent('create_list_from_add_item');
              onNavigateToListSettings?.();
            },
          },
        ],
      );
      return;
    }
    Telemetry.trackEvent('add_item_clicked', { list_id: currentListId });
    setStartStep(step);
    setVisible(true);
  };

  const close = () => {
    setVisible(false);
  };

  return {
    visible,
    startStep,
    open: () => openOn('search'),
    openManually: () => openOn('details'),
    close,
  };
}
