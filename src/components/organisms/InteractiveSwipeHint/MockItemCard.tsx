import React, { useState } from 'react';
import { View } from 'react-native';
// RNGH's Pressable (not the themed RN re-export): this mock card is mounted
// inside a ReanimatedSwipeable in the swipe-hint tutorial, and RN's Pressable
// doesn't coordinate with RNGH's gesture arena. See CLAUDE.md's Swipeable convention.
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface MockItemCardProps {
  mode: 'pantry' | 'shopping';
  onCheckboxPress?: () => void;
}

const MOCK_DATA = {
  pantry: {
    emoji: '🥬',
    title: 'Spinach',
    subtitle: 'Expires in 3 days',
    meta: '500g',
  },
  shopping: { emoji: '🥛', title: 'Milk', subtitle: 'Dairy', meta: '2L' },
};

/**
 * Visual-only card matching real item card appearance.
 * Shopping mode includes a checkbox that can be tapped when onCheckboxPress is provided.
 */
export const MockItemCard: React.FC<MockItemCardProps> = ({
  mode,
  onCheckboxPress,
}) => {
  const data = MOCK_DATA[mode];
  const [checked, setChecked] = useState(false);

  const handleCheckboxPress = () => {
    setChecked(true);
    onCheckboxPress?.();
  };

  styles.useVariants({ checked });

  return (
    <View style={styles.container}>
      {/* Checkbox for shopping mode — tappable when onCheckboxPress provided */}
      {mode === 'shopping' ? (
        onCheckboxPress ? (
          <Pressable onPress={handleCheckboxPress} hitSlop={8}>
            <View style={styles.checkbox}>
              {checked ? (
                <Icon name="checkmark" size={18} color="white" />
              ) : null}
            </View>
          </Pressable>
        ) : (
          <View style={styles.checkbox} />
        )
      ) : null}
      <View style={styles.emojiCircle}>
        <Text size="xl">{data.emoji}</Text>
      </View>
      <View style={styles.content}>
        <Text size="md" weight="semibold" numberOfLines={1}>
          {data.title}
        </Text>
        <Text
          size="sm"
          tone="secondary"
          style={styles.subtitle}
          numberOfLines={1}
        >
          {data.subtitle}
        </Text>
      </View>
      <Text size="sm" weight="medium" tone="secondary">
        {data.meta}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.sizes.itemCard.compact.height,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderLight,
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    variants: {
      checked: {
        true: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        false: {
          borderColor: theme.colors.border,
        },
      },
    },
  },
  emojiCircle: {
    width: theme.sizes.itemCard.compact.image,
    height: theme.sizes.itemCard.compact.image,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
}));
