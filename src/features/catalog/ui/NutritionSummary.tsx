import React from 'react';
import { useTranslation } from '#/i18n';
import type { ViewStyle } from 'react-native';
import { View, ScrollView } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { NutritionHighlight } from '#/types/nutrition';
import {
  type NutritionSummaryFacts,
  extractMacroSummary,
  generateHighlights,
  formatNutritionValue,
  formatCalories,
  hasNutritionData,
} from '#domain/nutrition';
import { Text, type TextTone } from '#components/atoms/Text';
import { Card } from '#components/atoms/Card';

interface NutritionSummaryProps {
  nutritionFacts: NutritionSummaryFacts | null;
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

const MACRO_TEXT_TONE: Record<MacroTone, TextTone> = {
  calories: 'accent',
  protein: 'success',
  carbs: 'warning',
  fat: 'danger',
};

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
        <Text role="bodyStrong" tone={MACRO_TEXT_TONE[tone]}>
          {value}
        </Text>
        {unit ? (
          <Text
            role="label"
            tone={MACRO_TEXT_TONE[tone]}
            style={circleStyles.unit}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      <Text
        role="caption"
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

const HIGHLIGHT_TEXT_TONE: Record<HighlightVariant, TextTone> = {
  positive: 'success',
  caution: 'warning',
  neutral: 'secondary',
};

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
      <Text role="label" tone={HIGHLIGHT_TEXT_TONE[variant]}>
        {t(highlight.labelKey)}
      </Text>
    </View>
  );
};

export const NutritionSummary: React.FC<NutritionSummaryProps> = ({
  nutritionFacts,
  showHighlights = true,
  compact = false,
  onPress,
  style,
}) => {
  styles.useVariants({ compact });
  const { t } = useTranslation();

  const macros = extractMacroSummary(nutritionFacts);

  const highlights = showHighlights ? generateHighlights(nutritionFacts) : [];

  if (!hasNutritionData(nutritionFacts)) {
    return null;
  }

  const content = (
    <Card padding="none" style={[styles.container, style]}>
      {/* Serving size label */}
      {!!macros.servingSize && (
        <Text
          role="caption"
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
          label={t('labels.calories')}
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
          label={t('labels.carbs')}
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
          <Text role="label" tone="accent">
            {t('labels.viewDetails')}
          </Text>
          <Icon name="chevron-forward" size={20} />
        </View>
      )}
    </Card>
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
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
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
    borderTopWidth: theme.borderWidth.hairline,
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
    borderWidth: theme.borderWidth.thick,
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
  unit: {
    marginTop: -theme.spacing['2xs'],
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
}));
