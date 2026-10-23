import React from 'react';
import { useMoney } from '#/domain/money';
import { useTranslation } from '#/i18n';
import { ListItem } from '#components/molecules/ListItem';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { IconButton } from '#components/atoms/IconButton';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { firstNonBlank } from '#/utils/firstNonBlank';

interface IngredientRowProps {
  ingredient: DisplayIngredient;
  isAdded: boolean;
  onAdd: () => void;
}

/** One ingredient on the recipe page: photo or nothing, name, amount, add. */
export const IngredientRow: React.FC<IngredientRowProps> = ({
  ingredient,
  isAdded,
  onAdd,
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
  const unit = firstNonBlank(
    converted ? converted.unit.symbol : null,
    ingredient.unit?.symbol,
  );
  const amount = [quantity, unit].filter(Boolean).join(' ');
  // US dollars, null until the recipe is first saved. Never derived from the name.
  const price =
    ingredient.estimatedPrice != null ? money(ingredient.estimatedPrice) : null;
  const subtitle = [amount, price].filter(Boolean).join(' · ') || undefined;
  // The API resolves `image` to an absolute address, a catalog item's first.
  const imageUrl = ingredient.image ?? ingredient.item?.imageUrl;

  return (
    <RowCard>
      <ListItem
        title={name}
        subtitle={subtitle}
        leftElement={<RowThumbnail uri={imageUrl} />}
        rightElement={
          <IconButton
            name={isAdded ? 'checkmark-circle' : 'add-circle-outline'}
            tone={isAdded ? 'success' : 'primary'}
            onPress={onAdd}
            disabled={isAdded}
            accessibilityLabel={
              isAdded ? t('labels.added') : t('labels.addNamed', { name })
            }
            accessibilityHint={
              isAdded ? undefined : t('labels.addToShoppingList')
            }
          />
        }
      />
    </RowCard>
  );
};
