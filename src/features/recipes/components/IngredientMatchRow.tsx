import React, { useState } from 'react';
import { useTranslation, type TranslationKey } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { ThemedTextInput } from '#components/atoms/themedComponents';

import {
  type EditableMatch,
  getAvailabilityStatus,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { Text, type TextTone } from '#components/atoms/Text';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatQuantityForDisplay,
  formatQuantityForInput,
} from '#/utils/formatQuantity';

interface IngredientMatchRowProps {
  editableMatch: EditableMatch;
  index: number;
  onUpdate: (
    index: number,
    updates: Partial<Pick<EditableMatch, 'adjustedQuantity' | 'isIncluded'>>,
  ) => void;
}

type BadgeColor = 'success' | 'warning' | 'error';

const BADGE_TEXT_TONE: Record<BadgeColor, TextTone> = {
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

/** Key paths — module-level table, resolved by the row that renders it. */
const BADGE_CONFIG: Record<
  ReturnType<typeof getAvailabilityStatus>,
  { labelKey: TranslationKey; color: BadgeColor }
> = {
  available: { labelKey: 'labels.available', color: 'success' },
  partial: { labelKey: 'labels.partial', color: 'warning' },
  missing: { labelKey: 'labels.missing', color: 'error' },
};

/**
 * Owns the `badgeColor` variant and its `useVariants` call. Extracted so the
 * row itself keeps compiling: Unistyles' variant transform bails the React
 * Compiler out of the containing function, and this row renders per ingredient.
 */
const AvailabilityBadge: React.FC<{
  badgeColor: BadgeColor;
  children: React.ReactNode;
}> = ({ badgeColor, children }) => {
  styles.useVariants({ badgeColor });
  return (
    <View style={styles.badge}>
      <Text role="label" tone={BADGE_TEXT_TONE[badgeColor]}>
        {children}
      </Text>
    </View>
  );
};

const IngredientMatchRowComponent: React.FC<IngredientMatchRowProps> = ({
  editableMatch,
  index,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const { match, ingredient, adjustedQuantity, isIncluded } = editableMatch;
  const status = getAvailabilityStatus(match);
  const badge = BADGE_CONFIG[status];
  const isOptional = ingredient.isOptional;

  // The field keeps its own text so a half-typed decimal ("1.") survives; it is
  // reseeded only when the quantity changes from outside the field.
  const [quantityText, setQuantityText] = useState(() =>
    formatQuantityForInput(adjustedQuantity, { notation: 'decimal' }),
  );
  const [syncedQuantity, setSyncedQuantity] = useState(adjustedQuantity);
  if (adjustedQuantity !== syncedQuantity) {
    setSyncedQuantity(adjustedQuantity);
    setQuantityText(
      formatQuantityForInput(adjustedQuantity, { notation: 'decimal' }),
    );
  }

  return (
    <View style={[styles.row, !isIncluded && styles.rowExcluded]}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            role="bodyStrong"
            style={[styles.name, !isIncluded && styles.textExcluded]}
            numberOfLines={1}
          >
            {ingredient.name}
          </Text>
          <AvailabilityBadge badgeColor={badge.color}>
            {isOptional ? t('ingredientMatch.optional') : t(badge.labelKey)}
          </AvailabilityBadge>
        </View>

        {!!match.matchedPantryItem && (
          <Text role="caption" tone="secondary" numberOfLines={1}>
            {t('ingredientMatch.matchedPantryItem', {
              name: match.matchedPantryItem.itemName,
              amount: `${formatQuantityForDisplay(
                match.matchedPantryItem.quantity,
              )}${
                match.matchedPantryItem.unit.symbol
                  ? ` ${match.matchedPantryItem.unit.symbol}`
                  : ''
              }`,
            })}
          </Text>
        )}

        <View style={styles.bottomRow}>
          <View style={styles.quantityRow}>
            <Text role="caption" tone="secondary">
              {t('ingredientMatch.qtyLabel')}
            </Text>
            <ThemedTextInput
              style={styles.quantityInput}
              value={quantityText}
              onChangeText={text => {
                setQuantityText(text);
                const parsed = parseDecimalInput(text);
                // A field holding no amount deducts nothing, never the last one.
                const num = !isNaN(parsed) && parsed >= 0 ? parsed : 0;
                setSyncedQuantity(num);
                onUpdate(index, { adjustedQuantity: num });
              }}
              keyboardType="decimal-pad"
              editable={isIncluded}
            />
            {!!match.suggestedUnit?.symbol && (
              <Text role="caption" tone="secondary">
                {match.suggestedUnit.symbol}
              </Text>
            )}
          </View>
          <BaseSwitch
            accessibilityLabel={ingredient.name}
            value={isIncluded}
            onValueChange={value => onUpdate(index, { isIncluded: value })}
          />
        </View>
      </View>
    </View>
  );
};

export const IngredientMatchRow = IngredientMatchRowComponent;

const styles = StyleSheet.create(theme => ({
  row: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  rowExcluded: {
    opacity: 0.5,
  },
  content: {
    gap: theme.spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
  },
  textExcluded: {
    color: theme.colors.textTertiary,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing['2xs'],
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    variants: {
      badgeColor: {
        success: { backgroundColor: theme.colors.success + '20' },
        warning: { backgroundColor: theme.colors.warning + '20' },
        error: { backgroundColor: theme.colors.error + '20' },
      },
    },
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  quantityInput: {
    minWidth: 60,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    ...theme.type.caption,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
}));
