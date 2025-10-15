import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  ImageStyle,
  TextStyle,
  ImageSourcePropType,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
    variant?: 'success' | 'error' | 'warning' | 'info';
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
}) => {
  const { theme } = useUnistyles();

  const renderImage = () => {
    if (leftElement) return null;

    if (image) {
      const imageSource = typeof image === 'string' ? { uri: image } : image;
      return (
        <Image
          source={imageSource}
          style={[
            layout === 'horizontal' ? styles.imageHorizontal : styles.imageVertical,
            imageStyle,
          ]}
          resizeMode={layout === 'horizontal' ? 'contain' : 'cover'}
        />
      );
    }

    if (imagePlaceholder && layout === 'vertical') {
      return (
        <View
          style={[
            styles.imageVertical,
            styles.imagePlaceholder,
            { backgroundColor: theme.colors.backgroundSecondary },
          ]}
        >
          <Text style={styles.placeholderText}>{imagePlaceholder}</Text>
        </View>
      );
    }

    return null;
  };

  const renderContent = () => (
    <View style={[styles.content, layout === 'horizontal' && styles.contentHorizontal]}>
      {badge && (
        <Badge variant={badge.variant} style={styles.badge}>
          {badge.text}
        </Badge>
      )}
      {title && (
        <Text
          style={[
            styles.title,
            { color: theme.colors.textPrimary },
            titleStyle,
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
      )}
      {subtitle && (
        <Text
          style={[styles.subtitle, { color: theme.colors.textSecondary }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      )}
      {description && (
        <Text
          style={[styles.description, { color: theme.colors.textSecondary }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      )}
      {price !== undefined && (
        <Text style={[styles.price, { color: theme.colors.success }]}>
          ${price.toFixed(2)}
        </Text>
      )}
      {meta && (
        <View style={styles.metaContainer}>
          {Array.isArray(meta) ? (
            meta.map((m, i) => (
              <Text
                key={i}
                style={[styles.meta, { color: theme.colors.textTertiary }]}
              >
                {m}
              </Text>
            ))
          ) : (
            <Text style={[styles.meta, { color: theme.colors.textTertiary }]}>
              {meta}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const cardContent = (
    <View
      style={[
        styles.card,
        variant === 'elevated' && {
          ...theme.shadows.md,
          backgroundColor: theme.colors.surface,
        },
        variant === 'flat' && {
          backgroundColor: theme.colors.surface,
        },
        variant === 'outlined' && {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        layout === 'vertical' && styles.cardVertical,
        disabled && styles.cardDisabled,
        style,
      ]}
      testID={testID}
    >
      {layout === 'horizontal' ? (
        <>
          {leftElement || renderImage()}
          {renderContent()}
          {rightElement && <View style={styles.rightSection}>{rightElement}</View>}
        </>
      ) : (
        <>
          {renderImage()}
          {renderContent()}
          {rightElement && <View style={styles.rightSection}>{rightElement}</View>}
        </>
      )}
      {bottomElement && <View style={styles.bottomSection}>{bottomElement}</View>}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
  },

  cardVertical: {
    flexDirection: 'column',
  },

  cardDisabled: {
    opacity: 0.6,
  },

  // Image styles
  imageHorizontal: {
    width: 64,
    height: 68,
    borderRadius: theme.radii.md,
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
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderText: {
    fontSize: 48,
  },

  // Content styles
  content: {
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },

  contentHorizontal: {
    justifyContent: 'center',
  },

  badge: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.xs,
  },

  title: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold as any,
    lineHeight: 24,
  },

  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 20,
  },

  description: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 20,
  },

  price: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.fonts.weight.semibold as any,
    marginTop: theme.spacing.xs,
  },

  metaContainer: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },

  meta: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: 'monospace',
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
}));

export default Card;
