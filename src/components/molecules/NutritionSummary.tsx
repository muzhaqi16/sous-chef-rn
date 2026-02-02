import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ViewStyle } from 'react-native';
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
        <Text style={[circleStyles.value, { color }]}>{value}</Text>
        {unit && <Text style={[circleStyles.unit, { color }]}>{unit}</Text>}
      </View>
      <Text style={circleStyles.label}>{label}</Text>
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
      <Text style={[badgeStyles.text, { color: textColor }]}>
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

  const nutritions = useMemo(
    () =>
      typeof nutritionsRaw === 'object' && nutritionsRaw !== null
        ? (nutritionsRaw as NutritionsData)
        : parseNutritions(nutritionsRaw),
    [nutritionsRaw],
  );

  const macros = useMemo(
    () => extractMacroSummary(nutritions, actualServingGrams),
    [nutritions, actualServingGrams],
  );

  const highlights = useMemo(
    () => (showHighlights ? generateHighlights(nutritions) : []),
    [nutritions, showHighlights],
  );

  if (!hasNutritionData(nutritions)) {
    return null;
  }

  const content = (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {/* Serving size label */}
      {macros.servingSize && (
        <Text style={styles.servingSize}>Per {macros.servingSize}</Text>
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
      {showHighlights && highlights.length > 0 && (
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
      {onPress && (
        <View style={styles.actionRow}>
          <Text style={styles.actionText}>View Details</Text>
          <Icon name="chevron-forward" size={20} library="Ionicons" />
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
          pressed && { opacity: 0.7 },
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
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  containerCompact: {
    padding: theme.spacing.sm,
  },
  servingSize: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
  actionText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
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
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  value: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.bold,
  },
  unit: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
    marginTop: -2,
  },
  label: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
}));

const badgeStyles = StyleSheet.create(theme => ({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
  },
  text: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
  },
}));
