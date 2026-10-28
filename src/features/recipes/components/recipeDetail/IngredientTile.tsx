import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useMoney } from '#/domain/money';
import { useTranslation, type TranslateFn } from '#/i18n';
import { Badge } from '#components/atoms/Badge';
import { CachedImage } from '#components/atoms/CachedImage';
import { Card } from '#components/atoms/Card';
import { SkeletonLine } from '#components/atoms/Skeleton/SkeletonLine';
import { SkeletonRectangle } from '#components/atoms/Skeleton/SkeletonRectangle';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import {
  alertSeverityLabelKey,
  householdAlertReasonKey,
  isStrictSeverity,
  strictestFirst,
  type HouseholdAlert,
} from '#domain/dietary';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';
import { formatQuantityForDisplay, unitLabel } from '#/utils/formatQuantity';
import { radii } from '#/theme/foundations/radii';
import { type } from '#/theme/foundations/type';

const IMAGE_SIZE = 64;

interface IngredientTileProps {
  ingredient: DisplayIngredient;
  isAdded: boolean;
  /** The household's alerts on it; with any, a tap opens them instead of adding. */
  alerts: HouseholdAlert[];
  /** Budget & prices is on; off, no price is shown or read out. */
  showPrice: boolean;
  onPress: () => void;
  testID?: string;
}

/** "Allergy", "Avoid +1": the most serious alert, by the word the profile picked. */
function alertSummary(alerts: HouseholdAlert[], t: TranslateFn): string | null {
  const [lead] = alerts;
  if (!lead) return null;
  const severityKey = alertSeverityLabelKey(lead);
  const label = severityKey
    ? t(severityKey)
    : t(householdAlertReasonKey(lead), { what: lead.what });
  return alerts.length > 1
    ? t('dietaryAlerts.andMore', { label, count: alerts.length - 1 })
    : label;
}

/**
 * One ingredient in the recipe page's rail: photo or nothing, amount, name and
 * price. A plain one adds itself on tap; a flagged one shows its alert and
 * opens the household sheet, so nobody adds it without seeing why.
 */
export const IngredientTile: React.FC<IngredientTileProps> = ({
  ingredient,
  isAdded,
  alerts,
  showPrice,
  onPress,
  testID,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  const name = ingredient.name || t('labels.unknown');
  // The server converts to the reader's own system; the stored pair is the
  // fallback when no unit of that system shares the ingredient's dimension.
  const converted = ingredient.convertedQuantity;
  const value = converted?.value ?? ingredient.quantity;
  // No amount ("salt, to taste"), or a legacy zero standing for none: show none.
  const quantity = value ? formatQuantityForDisplay(value) : null;
  const unit = unitLabel(converted ? converted.unit : ingredient.unit, {
    quantity: value ?? null,
  });
  const amount = [quantity, unit].filter(Boolean).join(' ');
  // US dollars, null until the recipe is first saved. Never derived from the name.
  const price =
    showPrice && ingredient.estimatedPrice != null
      ? money(ingredient.estimatedPrice)
      : null;
  // The API resolves `image` to an absolute address, a catalog item's first.
  const imageUrl = ingredient.image ?? ingredient.item?.imageUrl;
  const ordered = strictestFirst(alerts);
  const [lead] = ordered;
  const summary = alertSummary(ordered, t);
  const strict = !!lead && isStrictSeverity(lead.severity);
  styles.useVariants({ corner: isAdded ? 'added' : 'add' });

  return (
    <Card
      elevation="sm"
      padding="sm"
      style={styles.tile}
      onPress={onPress}
      disabled={isAdded ? !lead : false}
      accessibilityLabel={[name, amount, price, summary]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={
        lead
          ? t('recipes.ingredientAlerts.hint')
          : isAdded
          ? undefined
          : t('labels.addToShoppingList')
      }
      testID={testID}
    >
      {!!imageUrl && (
        <CachedImage
          uri={imageUrl}
          style={styles.image}
          displaySize={IMAGE_SIZE}
        />
      )}
      {!!amount && (
        <Text role="caption" tone="secondary" numberOfLines={1}>
          {amount}
        </Text>
      )}
      <Text role="label" align="center" numberOfLines={2}>
        {name}
      </Text>
      {!!price && (
        <Text role="label" tone="accent" numberOfLines={1}>
          {price}
        </Text>
      )}
      {!!summary && (
        <Badge
          variant={strict ? 'danger' : 'warning'}
          icon={strict ? 'alert-circle' : 'warning'}
        >
          {summary}
        </Badge>
      )}
      {isAdded ? (
        <View style={styles.corner}>
          <Icon name="checkmark" size={12} tone="onSuccess" />
        </View>
      ) : lead ? null : (
        <View style={styles.corner}>
          <Icon name="add" size={16} tone="onPrimary" />
        </View>
      )}
    </Card>
  );
};

/** The tile's placeholder: the same card, its photo and two lines of text. */
export const IngredientTileSkeleton: React.FC = () => (
  <Card elevation="sm" padding="sm" style={styles.tile}>
    <SkeletonRectangle
      width={IMAGE_SIZE}
      height={IMAGE_SIZE}
      borderRadius={radii.md}
    />
    <SkeletonLine width="50%" height={type.caption.fontSize} />
    <SkeletonLine width="80%" height={type.label.fontSize} />
  </Card>
);

const styles = StyleSheet.create(theme => ({
  tile: {
    width: 112,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceVariant,
  },
  corner: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 24,
    height: 24,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      corner: {
        add: { backgroundColor: theme.colors.primary },
        added: { backgroundColor: theme.colors.success },
      },
    },
  },
}));
