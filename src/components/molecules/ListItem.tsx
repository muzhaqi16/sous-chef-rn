import React from 'react';
import { useRowsOnCardFill } from '#components/atoms/RowCard';
import { useTranslation } from '#i18n';
import {
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
} from 'react-native';
import { ThemedIcon } from '#components/atoms/themedComponents';
import { RowFrame, type SwipeRowPress } from '#components/molecules/RowFrame';
import type { Icon } from '#components/atoms/Icon';
import { StyleSheet } from 'react-native-unistyles';
import { Badge, BadgeStack, type BadgeContent } from '#components/atoms/Badge';
import type { RowThemeColors } from '#components/atoms/rowTheme';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#styles/commonStyles';
import { rowType } from '#theme/foundations/type';
import { accessibilityLabelOf } from '#utils/accessibilityLabel';

export interface ListItemProps {
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
  /** A row picked in a list of choices: tinted, and reported as selected. */
  selected?: boolean;
  /** Drawn on the brand tint with nothing spoken for it, as an unread row is. */
  tinted?: boolean;
  leftIcon?: React.ComponentProps<typeof Icon>['name'];
  badge?: BadgeContent;
  /** Shown after the text, inside the row's press: nothing that presses. */
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
  /** A control before the row's text, such as a checkbox; its own element. */
  checkboxElement?: React.ReactNode;
  /** Controls after the row's text, each its own element beside the press. */
  trailingActions?: React.ReactNode;
  /** A pressable row's secondary actions, offered to a screen reader. */
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  /** From `SwipeableItem`, whose button is the row's press. */
  swipe?: SwipeRowPress;
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
  selected,
  tinted = false,
  leftIcon,
  badge,
  rightElement,
  leftElement,
  checkboxElement,
  trailingActions,
  accessibilityActions,
  onAccessibilityAction,
  swipe,
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
    </>
  );

  const subtitleText = typeof subtitle === 'string' ? subtitle : '';
  const press = onPress
    ? {
        onPress,
        onLongPress,
        accessibilityLabel:
          accessibilityLabel ??
          accessibilityLabelOf(title, subtitleText, badge?.text),
        accessibilityHint: accessibilityHint ?? t('labels.tapToViewDetails'),
        accessibilityState: {
          disabled: isPurchased,
          ...(selected === undefined ? {} : { selected }),
        },
        accessibilityActions,
        onAccessibilityAction,
      }
    : undefined;

  return (
    <RowFrame
      leading={checkboxElement}
      trailing={trailingActions}
      swipe={swipe}
      press={press}
      // A named row with nothing to press still reads as one element.
      accessibilityLabel={accessibilityLabel}
      surfaceStyle={[
        onCardFill && styles.onCardFill,
        (selected === true || tinted) && styles.tintedSurface,
      ]}
    >
      {content}
    </RowFrame>
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
