import React from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Text, type TextTone } from '#components/atoms/Text';
import { kitTestIDs } from '#components/testIDs';

export interface PageIndicatorItem {
  label: string;
  /** When true, renders an error accent on the dot + label. */
  hasError?: boolean;
}

interface PageIndicatorProps {
  pages: readonly (string | PageIndicatorItem)[];
  currentPage: number;
  onPagePress: (index: number) => void;
  /** A page button's id by index: a registry builder, `kitTestIDs.pageIndicator` by default. */
  testIDFor?: (index: number) => string;
}

const normalize = (
  page: string | PageIndicatorItem,
): Required<PageIndicatorItem> => {
  if (typeof page === 'string') return { label: page, hasError: false };
  return { label: page.label, hasError: !!page.hasError };
};

type DotState = 'error' | 'selected' | 'idle';

// A page with errors is flagged, not described, so its label is not error copy.
const LABEL_TONE: Record<DotState, TextTone> = {
  error: 'danger',
  selected: 'accent',
  idle: 'secondary',
};

const PageIndicatorItemRow: React.FC<{
  label: string;
  testID: string;
  selected: boolean;
  hasError: boolean;
  onPress: () => void;
}> = ({ label, testID, selected, hasError, onPress }) => {
  const state: DotState = hasError ? 'error' : selected ? 'selected' : 'idle';
  styles.useVariants({ state });

  return (
    <AppPressable
      // Indexed, not label-derived: the labels are translated, so a test
      // targeting them would pass in English and fail in every other locale.
      testID={testID}
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
        tone={LABEL_TONE[state]}
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
  testIDFor = kitTestIDs.pageIndicator,
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
            testID={testIDFor(index)}
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
}));
