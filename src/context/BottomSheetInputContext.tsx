import { createContext, useContext } from 'react';

/**
 * When `true`, input components (FormInput, FractionInput, FormTextArea)
 * automatically use `BottomSheetTextInput` instead of plain `TextInput`.
 *
 * Provided by `BottomSheetFormScrollView` so individual inputs no longer
 * need the `useBottomSheetInput` prop.
 */
const BottomSheetInputContext = createContext(false);

export const BottomSheetInputProvider = BottomSheetInputContext.Provider;

export const useIsBottomSheetInput = (): boolean =>
  useContext(BottomSheetInputContext);
