import React from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

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

type DotState = 'error' | 'selected' | 'idle';

const PageIndicatorItemRow: React.FC<{
  label: string;
  index: number;
  selected: boolean;
  hasError: boolean;
  onPress: () => void;
}> = ({ label, index, selected, hasError, onPress }) => {
  const state: DotState = hasError ? 'error' : selected ? 'selected' : 'idle';
  styles.useVariants({ state });

  return (
    <AppPressable
      // Indexed, not label-derived: the labels are translated, so a test
      // targeting them would pass in English and fail in every other locale.
      testID={`page-indicator-${index}`}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.item}
    >
      <View style={styles.dot} />
      <Text
        size="sm"
        weight={selected ? 'semibold' : 'regular'}
        style={styles.label}
      >
        {label}
      </Text>
    </AppPressable>
  );
};

export const PageIndicator: React.FC<PageIndicatorProps> = ({
  pages,
  currentPage,
  onPagePress,
}) => {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {pages.map((raw, index) => {
        const { label, hasError } = normalize(raw);
        const selected = currentPage === index;
        return (
          <PageIndicatorItemRow
            key={label}
            label={label}
            index={index}
            selected={selected}
            hasError={hasError}
            onPress={() => onPagePress(index)}
          />
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
    borderBottomWidth: theme.borderWidth.hairline,
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
    variants: {
      state: {
        error: { backgroundColor: theme.colors.error },
        selected: { backgroundColor: theme.colors.primary },
        idle: { backgroundColor: theme.colors.border },
      },
    },
  },
  label: {
    variants: {
      state: {
        error: { color: theme.colors.error },
        selected: { color: theme.colors.primary },
        idle: { color: theme.colors.textSecondary },
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
