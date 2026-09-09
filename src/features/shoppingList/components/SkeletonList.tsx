import React from 'react';
import { StyleProp, ViewStyle, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface SkeletonListProps {
  count?: number;
  SkeletonComponent: React.ComponentType;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Scrollable list of skeleton placeholders; pairs with `useDeferredRender()`. */
export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 6,
  SkeletonComponent,
  containerStyle,
}) => (
  <ScrollView
    style={styles.fill}
    contentContainerStyle={[styles.container, containerStyle]}
    showsVerticalScrollIndicator={false}
  >
    {Array.from({ length: count }, (_, index) => (
      <SkeletonComponent key={index} />
    ))}
  </ScrollView>
);

const styles = StyleSheet.create(theme => ({
  fill: {
    flex: 1,
  },
  container: {
    // This IS the list rendering the skeleton row, and `commonStyles.rowWrapper`
    // carries no horizontal inset by design, so the gutter has to come from here.
    paddingHorizontal: theme.layout.pageGutter,
    // `sm`, matching the inset the real list leaves above its first row — this
    // list stands beside that one, so a different step is a jump on release.
    paddingVertical: theme.spacing.sm,
    flexGrow: 1,
  },
}));
