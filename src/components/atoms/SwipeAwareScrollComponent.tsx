import type { ScrollViewProps } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

/**
 * The app's RNGH scroll host — FlashList's `renderScrollComponent` and a
 * standalone scroller alike. A native scroll takeover spares the v3 detectors
 * rows use, whose pan then opens them mid-scroll at any `dragOffset`; and RN
 * turns `nestedScrollEnabled` on under a `refreshControl`, parking the spinner.
 */
export const SwipeAwareScrollComponent = (props: ScrollViewProps) => (
  <ScrollView nestedScrollEnabled={false} {...props} />
);
