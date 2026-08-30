import { createContext, useContext } from 'react';

/**
 * `true` makes `FormInput` / `FractionInput` / `FormTextArea` resolve to
 * `BottomSheetTextInput`. Provided by `BottomSheetFormScrollView`.
 */
const BottomSheetInputContext = createContext(false);

export const BottomSheetInputProvider = BottomSheetInputContext.Provider;

export const useIsBottomSheetInput = (): boolean =>
  useContext(BottomSheetInputContext);
