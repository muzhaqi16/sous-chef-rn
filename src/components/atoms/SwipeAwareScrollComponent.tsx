import { ScrollView } from 'react-native-gesture-handler';

/**
 * RNGH's ScrollView, for FlashLists whose rows carry RNGH gestures. A native
 * scroll takeover fires `cancelAllLegacyHandlers()`, which spares the v3
 * detectors `ReanimatedSwipeable` uses — its pan then accumulates travel across
 * the scroll and opens rows at any `dragOffset`. An RNGH scrollable arbitrates.
 */
export const SwipeAwareScrollComponent = ScrollView;
