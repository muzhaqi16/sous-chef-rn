import { useState } from 'react';
import { Telemetry } from '#/services/telemetry';

export interface UseAddItemSheetOptions {
  currentListId: string | undefined;
}

export interface UseAddItemSheetResult {
  visible: boolean;
  /** The step the sheet opens on: its search, or its form for "Add manually". */
  startStep: 'search' | 'details';
  /** Opens on the list on screen; with none there is nothing to add to. */
  open: () => void;
  /** As `open`, on the details form. */
  openManually: () => void;
  close: () => void;
}

export function useAddItemSheet(
  options: UseAddItemSheetOptions,
): UseAddItemSheetResult {
  const { currentListId } = options;

  const [visible, setVisible] = useState(false);
  const [startStep, setStartStep] = useState<'search' | 'details'>('search');

  const openOn = (step: 'search' | 'details') => {
    if (!currentListId) return;
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
