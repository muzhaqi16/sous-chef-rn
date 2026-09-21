import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

/**
 * The trailing space a `Screen scroll="list"` child's content container takes:
 * the scaffold cannot pad a list it does not own, so the list reads the same
 * value the other scroll modes get.
 */
export const useScreenListInset = () => {
  const { bottom } = useSafeAreaInsets();
  return styles.listContent(bottom);
};

const styles = StyleSheet.create(theme => ({
  listContent: (bottomInset: number) => ({
    paddingBottom: bottomInset + theme.layout.pageBottom,
  }),
}));
