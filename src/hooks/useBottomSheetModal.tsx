import { useRef } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';

export const useBottomSheetModal = () => {
  const ref = useRef<BottomSheetModal>(null);
  const open = () => ref.current?.present();
  const close = () => ref.current?.dismiss();
  return { ref, open, close };
};
