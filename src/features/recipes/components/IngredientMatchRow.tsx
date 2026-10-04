import React, { useState } from 'react';
import { useTranslation, type TranslationKey } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { ThemedTextInput } from '#components/atoms/themedComponents';

import {
  type EditableMatch,
  type MatchUpdate,
  type PantryStackOption,
  getAvailabilityStatus,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { Text } from '#components/atoms/Text';
import { Badge, type BadgeVariant } from '#components/atoms/Badge';
import { ChipScrollRow } from '#components/molecules/ChipScrollRow';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatQuantityDisplay,
  formatQuantityForInput,
} from '#/utils/formatQuantity';

interface IngredientMatchRowProps {
  editableMatch: EditableMatch;
  index: number;
  onUpdate: (index: number, updates: MatchUpdate) => void;
}

/** Key paths — module-level table, resolved by the row that renders it. */
const BADGE_CONFIG: Record<
  ReturnType<typeof getAvailabilityStatus>,
  { labelKey: TranslationKey; variant: BadgeVariant }
> = {
  available: { labelKey: 'labels.available', variant: 'success' },
  partial: { labelKey: 'labels.partial', variant: 'warning' },
  missing: { labelKey: 'labels.missing', variant: 'danger' },
  unsure: { labelKey: 'labels.check', variant: 'warning' },
};

const stackAmount = (stack: PantryStackOption) =>
  formatQuantityDisplay(
    stack.displayAmount.quantity,
    stack.displayAmount.unit.symbol,
  );

const IngredientMatchRowComponent: React.FC<IngredientMatchRowProps> = ({
  editableMatch,
  index,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const {
    match,
    ingredient,
    stackOptions,
    selectedStack,
    adjustedQuantity,
    isIncluded,
  } = editableMatch;
  const status = getAvailabilityStatus(match);
  const badge = BADGE_CONFIG[status];
  const isOptional = ingredient.isOptional;
  // The server's availability speaks for its own pick only.
  const showsServerPick = selectedStack?.id === match.matchedPantryItem?.id;

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
          {isOptional ? (
            <Badge variant={badge.variant}>
              {t('ingredientMatch.optional')}
            </Badge>
          ) : (
            showsServerPick && (
              <Badge variant={badge.variant}>{t(badge.labelKey)}</Badge>
            )
          )}
        </View>

        {stackOptions.length > 1 && selectedStack ? (
          <ChipScrollRow
            options={stackOptions.map(stack => ({
              key: stack.id,
              label: t('labels.nameWithDetail', {
                name: stack.itemName,
                detail: stackAmount(stack),
              }),
            }))}
            selected={selectedStack.id}
            onSelect={id => {
              const picked = stackOptions.find(stack => stack.id === id);
              // Picking a stack is the confirmation an unsure match waits for.
              if (picked) {
                onUpdate(index, { selectedStack: picked, isIncluded: true });
              }
            }}
            edgeFadeColor="surface"
          />
        ) : (
          !!selectedStack && (
            <Text role="caption" tone="secondary" numberOfLines={1}>
              {t('ingredientMatch.matchedPantryItem', {
                name: selectedStack.itemName,
                amount: stackAmount(selectedStack),
              })}
            </Text>
          )
        )}

        {status === 'unsure' && !isIncluded && (
          <Text role="caption" tone="warning">
            {t('ingredientMatch.unsureHint')}
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
    opacity: theme.opacity.disabled,
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
