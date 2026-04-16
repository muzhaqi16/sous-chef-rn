import React from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export interface PageIndicatorItem {
  label: string;
  /** When true, renders an error accent on the dot + label. */
  hasError?: boolean;
}

interface PageIndicatorProps {
  pages: readonly (string | PageIndicatorItem)[];
  currentPage: number;
  onPagePress: (index: number) => void;
}

const normalize = (
  page: string | PageIndicatorItem,
): Required<PageIndicatorItem> => {
  if (typeof page === 'string') return { label: page, hasError: false };
  return { label: page.label, hasError: !!page.hasError };
};

export const PageIndicator: React.FC<PageIndicatorProps> = ({
  pages,
  currentPage,
  onPagePress,
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {pages.map((raw, index) => {
        const { label, hasError } = normalize(raw);
        const selected = currentPage === index;
        const dotColor = hasError
          ? theme.colors.error
          : selected
          ? theme.colors.primary
          : theme.colors.border;
        const labelColor = hasError
          ? theme.colors.error
          : selected
          ? theme.colors.primary
          : theme.colors.textSecondary;

        return (
          <Pressable
            key={label}
            onPress={() => onPagePress(index)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text
              style={[
                styles.label,
                {
                  color: labelColor,
                  fontWeight: selected ? '600' : '400',
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  item: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
  },
  label: {
    fontSize: theme.fonts.size.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
