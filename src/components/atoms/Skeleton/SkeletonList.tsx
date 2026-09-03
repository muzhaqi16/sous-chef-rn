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
    paddingVertical: theme.spacing.base,
    gap: theme.spacing.sm,
    flexGrow: 1,
  },
}));
