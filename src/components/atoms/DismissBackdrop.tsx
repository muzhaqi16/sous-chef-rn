import React from 'react';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useBottomSheet } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from './GlobalBottomSheetBackdrop';

export const DismissBackdrop: React.FC<BottomSheetBackdropProps> = props => {
  const { close } = useBottomSheet();
  return (
    <GlobalBottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      pressBehavior="close"
      onClose={close}
    />
  );
};
