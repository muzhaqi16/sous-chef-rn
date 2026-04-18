import React from 'react';
import { View, ViewStyle, ScrollView } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { NutritionsData, NutritionHighlight } from '#/types/nutrition';
import {
  parseNutritions,
  extractMacroSummary,
  generateHighlights,
  formatNutritionValue,
  formatCalories,
  hasNutritionData,
} from '#utils/nutritionUtils';
import { Text } from '#components/atoms/Text';

interface NutritionSummaryProps {
  /** Raw nutritions JSON from API or parsed NutritionsData */
  nutritions: unknown;
  /** Actual serving size in grams to scale values (optional) */
  actualServingGrams?: number | null;
  /** Show highlight badges (default: true) */
  showHighlights?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Navigation handler - shows chevron if provided */
  onPress?: () => void;
  /** Container style */
  style?: ViewStyle;
}

interface MacroCircleProps {
  label: string;
  value: string;
  unit?: string;
  color: string;
}

const MacroCircle: React.FC<MacroCircleProps> = ({
  label,
  value,
  unit,
  color,
}) => {
  return (
    <View style={circleStyles.container}>
      <View style={[circleStyles.circle, { borderColor: color }]}>
        <Text size="md" weight="bold" style={{ color }}>
          {value}
        </Text>
        {unit ? (
          <Text
            size="xs"
            weight="medium"
            style={[circleStyles.unit, { color }]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      <Text
        size="xs"
        tone="secondary"
        align="center"
        style={circleStyles.label}
      >
        {label}
      </Text>
    </View>
  );
};

interface HighlightBadgeProps {
  highlight: NutritionHighlight;
}

const HighlightBadge: React.FC<HighlightBadgeProps> = ({ highlight }) => {
  const { theme } = useUnistyles();

  const backgroundColor =
    highlight.type === 'positive'
      ? theme.colors.success + '20'
      : highlight.type === 'caution'
      ? theme.colors.warning + '20'
      : theme.colors.textSecondary + '20';

  const textColor =
    highlight.type === 'positive'
      ? theme.colors.success
      : highlight.type === 'caution'
      ? theme.colors.warning
      : theme.colors.textSecondary;

  return (
    <View style={[badgeStyles.badge, { backgroundColor }]}>
      <Text size="xs" weight="medium" style={{ color: textColor }}>
        {highlight.label}
      </Text>
    </View>
  );
};

export const NutritionSummary: React.FC<NutritionSummaryProps> = ({
  nutritions: nutritionsRaw,
  actualServingGrams,
  showHighlights = true,
  compact = false,
  onPress,
  style,
}) => {
  const { theme } = useUnistyles();

  const nutritions =
    typeof nutritionsRaw === 'object' && nutritionsRaw !== null
      ? (nutritionsRaw as NutritionsData)
      : parseNutritions(nutritionsRaw);

  const macros = extractMacroSummary(nutritions, actualServingGrams);

  const highlights = showHighlights ? generateHighlights(nutritions) : [];

  if (!hasNutritionData(nutritions)) {
    return null;
  }

  const content = (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {/* Serving size label */}
      {!!macros.servingSize && (
        <Text
          size="xs"
          tone="secondary"
          align="center"
          style={styles.servingSize}
        >
          Per {macros.servingSize}
        </Text>
      )}

      {/* Macro circles row */}
      <View style={styles.macrosRow}>
        <MacroCircle
          label="Calories"
          value={formatCalories(macros.calories)}
          color={theme.colors.primary}
        />
        <MacroCircle
          label="Protein"
          value={formatNutritionValue(macros.protein, '')}
          unit="g"
          color={theme.colors.success}
        />
        <MacroCircle
          label="Carbs"
          value={formatNutritionValue(macros.carbs, '')}
          unit="g"
          color={theme.colors.warning}
        />
        <MacroCircle
          label="Fat"
          value={formatNutritionValue(macros.fat, '')}
          unit="g"
          color={theme.colors.error}
        />
      </View>

      {/* Highlight badges */}
      {!!showHighlights && highlights.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.highlightsScroll}
          contentContainerStyle={styles.highlightsContent}
        >
          {highlights.map((highlight, index) => (
            <HighlightBadge key={index} highlight={highlight} />
          ))}
        </ScrollView>
      )}

      {/* Navigation chevron */}
      {!!onPress && (
        <View style={styles.actionRow}>
          <Text size="sm" weight="medium" tone="accent">
            View Details
          </Text>
          <Icon name="chevron-forward" size={20} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={null}
        needsOffscreenAlphaCompositing
        style={({ pressed }) => [
          { borderRadius: theme.radii.lg, overflow: 'hidden' },
          pressed && { opacity: theme.opacity.pressed },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 4,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.08)',
      },
    ],
  },
  containerCompact: {
    padding: theme.spacing.sm,
  },
  servingSize: {
    marginBottom: theme.spacing.sm,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  highlightsScroll: {
    marginTop: theme.spacing.md,
  },
  highlightsContent: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
}));

const circleStyles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    minWidth: 60,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: theme.radii['4xl'],
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  unit: {
    marginTop: -2,
  },
  label: {
    marginTop: theme.spacing.xs,
  },
}));

const badgeStyles = StyleSheet.create(theme => ({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
  },
}));
