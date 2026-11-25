import { useBottomSheetInternal } from '@gorhom/bottom-sheet';

/**
 * Whether this render sits inside a bottom sheet, as gorhom itself knows it:
 * its internal context is null anywhere else.
 */
export const useInBottomSheet = (): boolean =>
  useBottomSheetInternal(true) !== null;
