import {useCallback, useMemo, useRef, useState} from 'react';
import {BottomSheetModal} from '@gorhom/bottom-sheet';

export const useBottomSheetModal = () => {
  const ref = useRef<BottomSheetModal>(null);
  const open = useCallback(() => ref.current?.present(), []);
  const close = useCallback(() => ref.current?.dismiss(), []);
  return {ref, open, close};
};
