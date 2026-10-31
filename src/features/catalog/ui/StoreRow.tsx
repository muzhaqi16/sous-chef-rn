import React from 'react';
import { useTranslation } from '#/i18n';
import type { UnitSystem } from '#/graphql/generated/schemaTypes';
import { RowCard } from '#components/atoms/RowCard';
import { StatusLine, type StatusTone } from '#components/atoms/StatusLine';
import { Text } from '#components/atoms/Text';
import { ListItem } from '#components/molecules/ListItem';
import { SwipeableItem } from '#components/organisms/SwipeableItem/SwipeableItem';
import type { SwipeAction } from '#components/organisms/SwipeableItem/types';
import { rowType } from '#/theme/foundations/type';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';
import { describeStoreOption, type StoreOption } from '#domain/stores';

interface StoreRowProps {
  option: StoreOption;
  /** Read once per list (`useReadingSystem`), for the distance. */
  readingSystem: UnitSystem;
  /** A line under the branch, such as where its prices come from. */
  detail?: string;
  /** The line under the branch saying what state the store is in. */
  status?: { tone: StatusTone; text: string };
  /** Marks a store the household already has. */
  markAdded?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Swipe actions; their testIDs take `testIDPrefix`. */
  swipe?: { left?: SwipeAction[]; right?: SwipeAction[]; testIDPrefix: string };
  testID?: string;
}

/** One store, or a whole chain, in a list: its name, branch and distance. */
export const StoreRow: React.FC<StoreRowProps> = ({
  option,
  readingSystem,
  detail,
  status,
  markAdded = false,
  trailing,
  onPress,
  swipe,
  testID,
}) => {
  const { t } = useTranslation();
  const { title, subtitle } = describeStoreOption(option, t, readingSystem);
  const added = markAdded && option.added ? t('labels.added') : undefined;
  const label = accessibilityLabelOf(
    title,
    subtitle,
    detail,
    status?.text,
    added,
  );

  const row = (
    <ListItem
      title={title}
      titleNumberOfLines={1}
      subtitle={
        subtitle || detail || status ? (
          <>
            {subtitle ? (
              <Text role={rowType.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {detail ? (
              <Text role={rowType.subtitle} numberOfLines={2}>
                {detail}
              </Text>
            ) : null}
            {status ? (
              <StatusLine tone={status.tone}>{status.text}</StatusLine>
            ) : null}
          </>
        ) : undefined
      }
      badge={added ? { text: added } : undefined}
      rightElement={trailing}
      // Swiped, the swipe's container is the row's one accessible element.
      accessibilityLabel={swipe ? undefined : label}
      accessibilityHint=""
      onPress={swipe ? undefined : onPress}
    />
  );

  return (
    <RowCard testID={testID}>
      {swipe ? (
        <SwipeableItem
          itemId={option.key}
          testIDPrefix={swipe.testIDPrefix}
          accessibilityLabel={label}
          leftActions={swipe.left}
          rightActions={swipe.right}
          onPress={onPress}
        >
          {row}
        </SwipeableItem>
      ) : (
        row
      )}
    </RowCard>
  );
};
