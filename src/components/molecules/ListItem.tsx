import React from 'react';
import { useTranslation } from '#/i18n';
import { View, TextStyle } from 'react-native';
import { ThemedIcon } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import { Badge } from '#components/atoms/Badge';
import type { RowThemeColors } from '#components/atoms/rowTheme';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';

interface ListItemProps {
  children?: React.ReactNode;
  title?: string;
  /** Max lines for the title before truncating. Defaults to 2. */
  titleNumberOfLines?: number;
  subtitle?: string | React.ReactNode;
  onPress?: () => void;
  leftIcon?: React.ComponentProps<typeof Icon>['name'];
  // `null` suppresses the default trailing chevron.
  rightIcon?: React.ComponentProps<typeof Icon>['name'] | null;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
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
  title,
  titleNumberOfLines = 2,
  subtitle,
  onPress,
  leftIcon,
  rightIcon = 'chevron-forward',
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

  if (children) {
    return (
      <View style={commonStyles.rowSurface}>
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
          size={24}
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
            <ListItemSubtitleSlot purchased={isPurchased}>
              {subtitle}
            </ListItemSubtitleSlot>
          ))}
      </View>
      {!!badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
      {rightElement}
      {!!rightIcon && !rightElement && (
        <ThemedIcon
          name={rightIcon}
          size={24}
          uniProps={theme => ({
            color: overrideIconColor ?? theme.colors.textSecondary,
          })}
        />
      )}
      {dragHandleElement}
    </>
  );

  if (onPress) {
    const subtitleText = typeof subtitle === 'string' ? subtitle : '';
    const accessibilityLabel = [title, subtitleText, badge?.text]
      .filter(Boolean)
      .join(', ');

    return (
      <View style={commonStyles.rowSurface}>
        <AppPressable
          style={[commonStyles.rowClip, commonStyles.rowContent]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={t('labels.tapToViewDetails')}
          accessibilityState={{ disabled: isPurchased }}
        >
          {content}
        </AppPressable>
      </View>
    );
  }

  return (
    <View style={commonStyles.rowSurface}>
      <View style={commonStyles.rowContent}>{content}</View>
    </View>
  );
};

/**
 * The three `purchased`-variant surfaces, each owning its own `useVariants` call.
 * Unistyles' variant transform silently bails the React Compiler out of whichever
 * function contains that call, and `ListItem` renders every shopping-list row, so
 * it is the one that must stay compiled; a bailout in these leaves costs nothing.
 */
const ListItemTitle: React.FC<{
  purchased: boolean;
  numberOfLines: number;
  children: React.ReactNode;
}> = ({ purchased, numberOfLines, children }) => {
  styles.useVariants({ purchased });
  return (
    <Text
      role={rowType.title}
      style={styles.title}
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
  styles.useVariants({ purchased });
  return (
    <Text
      role={rowType.subtitle}
      style={styles.subtitle}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {children}
    </Text>
  );
};

const ListItemSubtitleSlot: React.FC<{
  purchased: boolean;
  children: React.ReactNode;
}> = ({ purchased, children }) => {
  styles.useVariants({ purchased });
  return <View style={styles.subtitleContainer}>{children}</View>;
};

export const ListItem = ListItemComponent;

const styles = StyleSheet.create(theme => ({
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
      purchased: {
        true: {
          textDecorationLine: 'line-through' as TextStyle['textDecorationLine'],
          opacity: theme.opacity.disabled,
          color: theme.colors.textSecondary,
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
          textDecorationLine: 'line-through' as TextStyle['textDecorationLine'],
          opacity: theme.opacity.disabled,
        },
      },
    },
  },
  subtitleContainer: {
    marginTop: theme.layout.rowTextGap,
    variants: {
      purchased: {
        true: {
          opacity: theme.opacity.disabled,
        },
      },
    },
  },
}));
