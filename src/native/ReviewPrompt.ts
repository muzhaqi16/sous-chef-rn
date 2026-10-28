import { nativeMethod } from './nativeModule';

/** StoreKit's or Google Play's in-app review; a build without the module does nothing. */
export const ReviewPrompt = {
  request() {
    nativeMethod('ReviewPromptModule', 'requestReview')?.();
  },
};
