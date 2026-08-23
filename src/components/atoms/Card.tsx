import React from 'react';
import { useTranslation } from '#/i18n';
import {
  View,
  Image,
  StyleProp,
  ViewStyle,
  ImageStyle,
  TextStyle,
  ImageSourcePropType,
} from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { Badge } from './Badge';

export interface CardProps {
  /** Card variant - affects layout and styling */
  variant?: 'elevated' | 'flat' | 'outlined';

  /** Layout direction */
  layout?: 'horizontal' | 'vertical';

  /** Image source (optional) */
  image?: string | ImageSourcePropType;

  /** Placeholder when no image (emoji or text) */
  imagePlaceholder?: string;

  /** Title text */
  title?: string;

  /** Subtitle text */
  subtitle?: string;

  /** Description text */
  description?: string;

  /** Badge props */
  badge?: {
    text: string;
    variant?: 'success' | 'danger' | 'warning' | 'default' | 'primary';
  };

  /** Price (for product cards) */
  price?: number;

  /** Meta text (barcode, format, etc.) */
  meta?: string | string[];

  /** Left element (icon, avatar, etc.) */
  leftElement?: React.ReactNode;

  /** Right element (counter, button, etc.) */
  rightElement?: React.ReactNode;

  /** Bottom element (actions, buttons, etc.) */
  bottomElement?: React.ReactNode;

  /** On press handler - makes card touchable */
  onPress?: () => void;

  /** Disabled state */
  disabled?: boolean;

  /** Container styles */
  style?: StyleProp<ViewStyle>;

  /** Image styles */
  imageStyle?: StyleProp<ImageStyle>;

  /** Title styles */
  titleStyle?: StyleProp<TextStyle>;

  /** Test ID for testing */
  testID?: string;

  /** Accessibility label */
  accessibilityLabel?: string;

  /** Accessibility hint */
  accessibilityHint?: string;
}

export const Card: React.FC<CardProps> = ({
  variant = 'flat',
  layout = 'horizontal',
  image,
  imagePlaceholder = '📦',
  title,
  subtitle,
  description,
  badge,
  price,
  meta,
  leftElement,
  rightElement,
  bottomElement,
  onPress,
  disabled = false,
  style,
  imageStyle,
  titleStyle,
  testID,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { t } = useTranslation();
  styles.useVariants({
    layout,
    disabled,
    variant,
  });

  const renderImage = () => {
    if (leftElement) return null;

    if (image) {
      const imageSource = typeof image === 'string' ? { uri: image } : image;
      return (
        <Image
          source={imageSource}
          style={[
            layout === 'horizontal'
              ? styles.imageHorizontal
              : styles.imageVertical,
            imageStyle,
          ]}
          resizeMode={layout === 'horizontal' ? 'contain' : 'cover'}
        />
      );
    }

    if (imagePlaceholder && layout === 'vertical') {
      return (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderText}>{imagePlaceholder}</Text>
        </View>
      );
    }

    return null;
  };

  const renderContent = () => (
    <View style={styles.content}>
      {!!badge && (
        <Badge variant={badge.variant} style={styles.badge}>
          {badge.text}
        </Badge>
      )}
      {!!title && (
        <Text style={[styles.title, titleStyle]} numberOfLines={2}>
          {title}
        </Text>
      )}
      {!!subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
      {!!description && (
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      )}
      {price !== undefined && (
        <Text style={styles.price}>${price.toFixed(2)}</Text>
      )}
      {!!meta && (
        <View style={styles.metaContainer}>
          {Array.isArray(meta) ? (
            meta.map((m, i) => (
              <Text key={i} style={styles.meta}>
                {m}
              </Text>
            ))
          ) : (
            <Text style={styles.meta}>{meta}</Text>
          )}
        </View>
      )}
    </View>
  );

  const cardContent = (
    <View style={[styles.card, style]} testID={testID}>
      {layout === 'horizontal' ? (
        <>
          {leftElement || renderImage()}
          {renderContent()}
          {!!rightElement && (
            <View style={styles.rightSection}>{rightElement}</View>
          )}
        </>
      ) : (
        <>
          {renderImage()}
          {renderContent()}
          {!!rightElement && (
            <View style={styles.rightSection}>{rightElement}</View>
          )}
        </>
      )}
      {!!bottomElement && (
        <View style={styles.bottomSection}>{bottomElement}</View>
      )}
    </View>
  );

  if (onPress && !disabled) {
    // Build accessible label from card content if not explicitly provided
    const cardLabel =
      accessibilityLabel ||
      [title, subtitle, description].filter(Boolean).join(', ');

    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => pressed && styles.pressed}
        accessibilityRole="button"
        accessibilityLabel={cardLabel}
        accessibilityHint={accessibilityHint || t('labels.tapToViewDetails')}
        accessibilityState={{ disabled }}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    variants: {
      layout: {
        horizontal: {},
        vertical: { flexDirection: 'column' },
      },
      disabled: {
        true: { opacity: theme.opacity.disabled },
        false: {},
      },
      variant: {
        elevated: { ...theme.shadows.md },
        flat: {},
        outlined: { borderWidth: 1, borderColor: theme.colors.border },
      },
    },
  },

  // Image styles
  imageHorizontal: {
    width: 64,
    height: 68,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    margin: theme.spacing.sm,
    alignSelf: 'center',
  },

  imageVertical: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
  },

  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
  },

  placeholderText: {
    fontSize: theme.typography.fontSize['4xl'],
  },

  // Content styles
  content: {
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    variants: {
      layout: {
        horizontal: { justifyContent: 'center' },
        vertical: {},
      },
    },
  },

  badge: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.xs,
  },

  title: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    lineHeight: theme.typography.lineHeight.normal,
    color: theme.colors.textPrimary,
  },

  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.tight,
    color: theme.colors.textSecondary,
  },

  description: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.tight,
    color: theme.colors.textSecondary,
  },

  price: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.fonts.weight.semibold,
    marginTop: theme.spacing.xs,
    color: theme.colors.success,
  },

  metaContainer: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },

  meta: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: 'monospace',
    color: theme.colors.textTertiary,
  },

  // Section styles
  rightSection: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: theme.spacing.md,
  },

  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.md,
  },

  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default Card;
