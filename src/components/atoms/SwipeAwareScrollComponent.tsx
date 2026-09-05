import type { ScrollViewProps } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

/**
 * RNGH's ScrollView, for FlashLists whose rows carry RNGH gestures: a native
 * scroll takeover spares the v3 detectors `ReanimatedSwipeable` uses, whose pan
 * then opens rows mid-scroll at any `dragOffset`. `nestedScrollEnabled` is off
 * because RN turns it on under a `refreshControl`, parking the spinner mid-pull.
 */
export const SwipeAwareScrollComponent = (props: ScrollViewProps) => (
  <ScrollView nestedScrollEnabled={false} {...props} />
);
