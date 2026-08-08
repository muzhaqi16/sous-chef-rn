import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, ViewStyle, ScrollView } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
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

type MacroTone = 'calories' | 'protein' | 'carbs' | 'fat';

interface MacroCircleProps {
  label: string;
  value: string;
  unit?: string;
  tone: MacroTone;
}

const MacroCircle: React.FC<MacroCircleProps> = ({
  label,
  value,
  unit,
  tone,
}) => {
  circleStyles.useVariants({ tone });
  return (
    <View style={circleStyles.container}>
      <View style={circleStyles.circle}>
        <Text size="md" weight="bold" style={circleStyles.value}>
          {value}
        </Text>
        {unit ? (
          <Text size="xs" weight="medium" style={circleStyles.unit}>
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

type HighlightVariant = 'positive' | 'caution' | 'neutral';

const toVariant = (type: NutritionHighlight['type']): HighlightVariant =>
  type === 'positive' ? 'positive' : type === 'caution' ? 'caution' : 'neutral';

interface HighlightBadgeProps {
  highlight: NutritionHighlight;
}

const HighlightBadge: React.FC<HighlightBadgeProps> = ({ highlight }) => {
  const { t } = useTranslation();
  const variant = toVariant(highlight.type);
  badgeStyles.useVariants({ variant });

  return (
    <View style={badgeStyles.badge}>
      <Text size="xs" weight="medium" style={badgeStyles.label}>
        {t(highlight.labelKey)}
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
  styles.useVariants({ compact });
  const { t } = useTranslation();

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
    <View style={[styles.container, style]}>
      {/* Serving size label */}
      {!!macros.servingSize && (
        <Text
          size="xs"
          tone="secondary"
          align="center"
          style={styles.servingSize}
        >
          {t('nutritionSummary.perServing', { serving: macros.servingSize })}
        </Text>
      )}

      {/* Macro circles row */}
      <View style={styles.macrosRow}>
        <MacroCircle
          label={t('nutritionSummary.macroCalories')}
          value={formatCalories(macros.calories)}
          tone="calories"
        />
        <MacroCircle
          label={t('nutritionSummary.macroProtein')}
          value={formatNutritionValue(macros.protein, '')}
          unit="g"
          tone="protein"
        />
        <MacroCircle
          label={t('nutritionSummary.macroCarbs')}
          value={formatNutritionValue(macros.carbs, '')}
          unit="g"
          tone="carbs"
        />
        <MacroCircle
          label={t('nutritionSummary.macroFat')}
          value={formatNutritionValue(macros.fat, '')}
          unit="g"
          tone="fat"
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
            {t('labels.viewDetails')}
          </Text>
          <Icon name="chevron-forward" size={20} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <AppPressable
        onPress={onPress}
        android_ripple={null}
        needsOffscreenAlphaCompositing
        style={styles.pressableWrapper}
      >
        {content}
      </AppPressable>
    );
  }

  return content;
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
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
    variants: {
      compact: {
        true: { padding: theme.spacing.sm },
      },
    },
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
  pressableWrapper: {
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  pressed: {
    opacity: theme.opacity.pressed,
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
    borderCurve: 'continuous',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    variants: {
      tone: {
        calories: { borderColor: theme.colors.primary },
        protein: { borderColor: theme.colors.success },
        carbs: { borderColor: theme.colors.warning },
        fat: { borderColor: theme.colors.error },
      },
    },
  },
  value: {
    variants: {
      tone: {
        calories: { color: theme.colors.primary },
        protein: { color: theme.colors.success },
        carbs: { color: theme.colors.warning },
        fat: { color: theme.colors.error },
      },
    },
  },
  unit: {
    marginTop: -2,
    variants: {
      tone: {
        calories: { color: theme.colors.primary },
        protein: { color: theme.colors.success },
        carbs: { color: theme.colors.warning },
        fat: { color: theme.colors.error },
      },
    },
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
    variants: {
      variant: {
        positive: { backgroundColor: theme.colors.success + '20' },
        caution: { backgroundColor: theme.colors.warning + '20' },
        neutral: { backgroundColor: theme.colors.textSecondary + '20' },
      },
    },
  },
  label: {
    variants: {
      variant: {
        positive: { color: theme.colors.success },
        caution: { color: theme.colors.warning },
        neutral: { color: theme.colors.textSecondary },
      },
    },
  },
}));
