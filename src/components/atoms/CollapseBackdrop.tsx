import React from 'react';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useBottomSheet } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from './GlobalBottomSheetBackdrop';

export const CollapseBackdrop: React.FC<BottomSheetBackdropProps> = props => {
  const { collapse } = useBottomSheet();
  return (
    <GlobalBottomSheetBackdrop
      {...props}
      disappearsOnIndex={0}
      appearsOnIndex={1}
      pressBehavior="collapse"
      onClose={collapse}
    />
  );
};
