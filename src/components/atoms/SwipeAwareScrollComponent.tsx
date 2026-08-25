import { ScrollView } from 'react-native-gesture-handler';

/**
 * RNGH's ScrollView, for FlashLists whose rows carry RNGH gestures.
 *
 * A native ScrollView taking over a touch calls `requestDisallowInterceptTouchEvent`,
 * which RNGH answers with `cancelAllLegacyHandlers()` — and that, per its own
 * docblock, "Cancels all handlers created using API v1 and v2". `ReanimatedSwipeable`
 * is on the v3 detectors, so its pan survives the takeover, keeps accumulating
 * horizontal travel for the whole scroll, and eventually crosses any activation
 * distance — which is why no `dragOffset` value fixes rows opening mid-scroll.
 *
 * Making the scrollable an RNGH handler routes arbitration through the orchestrator
 * instead, where `makeActive` cancels every non-simultaneous handler, so the scroll
 * cancels the row's pan.
 *
 * Revisit here if RNGH closes the gap upstream — issue #4432 / PR #4441 cover the
 * Pressable variant, gated on `is NativeViewGestureHandler`, so they miss this one.
 */
export const SwipeAwareScrollComponent = ScrollView;
