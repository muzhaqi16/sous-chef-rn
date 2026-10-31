import React from 'react';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { useTranslation } from '#/i18n';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { ListItem } from '#components/molecules/ListItem';
import { profileTestIDs } from '#features/profile/testIDs';
import { resolveImageUrl } from '#utils/imageUtils';
import { AvoidFoodRow_ItemFragmentDoc } from './AvoidFoodRow.generated';

interface AvoidFoodRowProps {
  food: FragmentType<typeof AvoidFoodRow_ItemFragmentDoc>;
  /** The picked food, with the name a caller lists it by. */
  onPress: (food: { id: string; name: string }) => void;
}

/** One food an avoid search found: its photo or nothing, name and category. */
export const AvoidFoodRow: React.FC<AvoidFoodRowProps> = ({
  food,
  onPress,
}) => {
  const { t } = useTranslation();
  const { data: item, complete } = useFragment({
    fragment: AvoidFoodRow_ItemFragmentDoc,
    fragmentName: 'AvoidFoodRow_item',
    from: food,
  });

  if (!complete) return null;

  const [first] = item.categories;
  const filing = item.categories.find(entry => entry.isPrimary) ?? first;

  return (
    <RowCard testID={profileTestIDs.avoidCandidate(item.id)}>
      <ListItem
        title={item.name}
        subtitle={filing?.category.name}
        leftElement={<RowThumbnail uri={resolveImageUrl(item)} />}
        onPress={() => onPress({ id: item.id, name: item.name })}
        accessibilityLabel={t('dietaryProfile.avoidNamed', { name: item.name })}
      />
    </RowCard>
  );
};
