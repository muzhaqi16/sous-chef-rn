import React from 'react';
import { useRowsOnCardFill } from '#components/atoms/RowCard';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { ThemedIcon } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import type { Icon } from '#components/atoms/Icon';
import { StyleSheet } from 'react-native-unistyles';
import { Badge, BadgeStack, type BadgeContent } from '#components/atoms/Badge';
import type { RowThemeColors } from '#components/atoms/rowTheme';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';

interface ListItemProps {
  children?: React.ReactNode;
  /** A pressable row's spoken label; title, subtitle and badge when absent. */
  accessibilityLabel?: string;
  /**
   * Replaces the pressable row's "Tap to view details" for a row whose tap does
   * something else; empty when its label already says what the tap does.
   */
  accessibilityHint?: string;
  title?: string;
  /** Max lines for the title before truncating. Defaults to 2. */
  titleNumberOfLines?: number;
  subtitle?: string | React.ReactNode;
  onPress?: () => void;
  /** A pressable row's second action, such as a folder's manage menu. */
  onLongPress?: () => void;
  /** A pressable row that does nothing for now; said so to assistive tech. */
  disabled?: boolean;
  /** A row picked in a list of choices: tinted, and reported as selected. */
  selected?: boolean;
  /** Drawn on the brand tint with nothing spoken for it, as an unread row is. */
  tinted?: boolean;
  leftIcon?: React.ComponentProps<typeof Icon>['name'];
  badge?: BadgeContent;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
  checkboxElement?: React.ReactNode; // Optional checkbox before leftElement (for shopping list)
  dragHandleElement?: React.ReactNode; // Optional drag handle before checkbox (for reordering)
  isPurchased?: boolean; // For strikethrough styling
  // Forwarded to `withUnistyles(Icon)`; null keeps the theme-reactive default.
  themeColors?: RowThemeColors | null;
}

const ListItemComponent: React.FC<ListItemProps> = ({
  children,
  accessibilityLabel,
  accessibilityHint,
  title,
  titleNumberOfLines = 2,
  subtitle,
  onPress,
  onLongPress,
  disabled = false,
  selected,
  tinted = false,
  leftIcon,
  badge,
  rightElement,
  leftElement,
  checkboxElement,
  dragHandleElement,
  isPurchased = false,
  themeColors,
}) => {
  const { t } = useTranslation();
  const overrideIconColor = themeColors?.textSecondary;
  // On a card that lights up, the card's fill shows through the row.
  const onCardFill = useRowsOnCardFill();
  const surface = [commonStyles.rowSurface, onCardFill && styles.onCardFill];

  if (children) {
    return (
      <View style={surface}>
        <View style={commonStyles.rowContent}>{children}</View>
      </View>
    );
  }

  const content = (
    <>
      {!!checkboxElement && (
        <View style={styles.checkboxContainer}>{checkboxElement}</View>
      )}
      {leftElement}
      {!!leftIcon && (
        <ThemedIcon
          name={leftIcon}
          size="md"
          uniProps={theme => ({
            color: overrideIconColor ?? theme.colors.textSecondary,
          })}
        />
      )}
      <View style={styles.content}>
        <ListItemTitle
          purchased={isPurchased}
          numberOfLines={titleNumberOfLines}
        >
          {title}
        </ListItemTitle>
        {!!subtitle &&
          (typeof subtitle === 'string' ? (
            <ListItemSubtitle purchased={isPurchased}>
              {subtitle}
            </ListItemSubtitle>
          ) : (
            <View style={styles.subtitleContainer}>{subtitle}</View>
          ))}
      </View>
      {!!badge &&
        (badge.lines ? (
          <BadgeStack label={badge.text} lines={badge.lines} />
        ) : (
          <Badge variant={badge.variant}>{badge.text}</Badge>
        ))}
      {rightElement}
      {dragHandleElement}
    </>
  );

  if (onPress) {
    const subtitleText = typeof subtitle === 'string' ? subtitle : '';

    return (
      <View
        style={[surface, (selected === true || tinted) && styles.tintedSurface]}
      >
        <AppPressable
          style={commonStyles.rowContent}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={onLongPress ? 500 : undefined}
          // Only when set: Pressable's `disabled={false}` would override the
          // purchased row's spoken state below.
          disabled={disabled || undefined}
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ??
            accessibilityLabelOf(title, subtitleText, badge?.text)
          }
          accessibilityHint={accessibilityHint ?? t('labels.tapToViewDetails')}
          accessibilityState={{
            disabled: isPurchased || disabled,
            ...(selected === undefined ? {} : { selected }),
          }}
        >
          {content}
        </AppPressable>
      </View>
    );
  }

  // A named row with nothing to press still reads as one element.
  return (
    <View style={surface}>
      <View
        style={commonStyles.rowContent}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </View>
    </View>
  );
};

/**
 * The two `purchased`-variant surfaces, each owning its own `useVariants` call.
 * Unistyles' variant transform silently bails the React Compiler out of whichever
 * function contains that call, and `ListItem` renders every shopping-list row, so
 * it is the one that must stay compiled; a bailout in these leaves costs nothing.
 */
const ListItemTitle: React.FC<{
  purchased: boolean;
  numberOfLines: number;
  children: React.ReactNode;
}> = ({ purchased, numberOfLines, children }) => {
  const variantStyles = styles.useVariants({ purchased });
  return (
    <Text
      role={rowType.title}
      style={variantStyles.title}
      numberOfLines={numberOfLines}
      ellipsizeMode="tail"
    >
      {children}
    </Text>
  );
};

const ListItemSubtitle: React.FC<{
  purchased: boolean;
  children: React.ReactNode;
}> = ({ purchased, children }) => {
  const variantStyles2 = styles.useVariants({ purchased });
  return (
    <Text
      role={rowType.subtitle}
      style={variantStyles2.subtitle}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {children}
    </Text>
  );
};

export const ListItem = ListItemComponent;

const styles = StyleSheet.create(theme => ({
  onCardFill: {
    backgroundColor: 'transparent',
  },
  tintedSurface: {
    backgroundColor: theme.colors.primaryLight,
  },
  checkboxContainer: {
    justifyContent: 'center',
    // Never compressed when the row has no image.
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  title: {
    color: theme.colors.textPrimary,
    variants: {
      // A colour, not opacity: a purchased row can still be unticked, so its
      // text holds AA (`textTertiary` is held on the page grounds).
      purchased: {
        true: {
          textDecorationLine: 'line-through',
          color: theme.colors.textTertiary,
        },
      },
    },
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginTop: theme.layout.rowTextGap,
    variants: {
      purchased: {
        true: {
          textDecorationLine: 'line-through',
          color: theme.colors.textTertiary,
        },
      },
    },
  },
  subtitleContainer: {
    marginTop: theme.layout.rowTextGap,
  },
}));
