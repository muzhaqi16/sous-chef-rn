import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

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
  const { theme } = useUnistyles();
  const data = MOCK_DATA[mode];
  const [checked, setChecked] = useState(false);

  const handleCheckboxPress = () => {
    setChecked(true);
    onCheckboxPress?.();
  };

  return (
    <View style={styles.container}>
      {/* Checkbox for shopping mode — tappable when onCheckboxPress provided */}
      {mode === 'shopping' ? (
        onCheckboxPress ? (
          <Pressable onPress={handleCheckboxPress} hitSlop={8}>
            <View
              style={[
                styles.checkbox,
                checked
                  ? {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                    }
                  : { borderColor: theme.colors.border },
              ]}
            >
              {checked ? (
                <Icon name="checkmark" size={18} color="white" />
              ) : null}
            </View>
          </Pressable>
        ) : (
          <View
            style={[styles.checkbox, { borderColor: theme.colors.border }]}
          />
        )
      ) : null}
      <View
        style={[
          styles.emojiCircle,
          { backgroundColor: theme.colors.primaryLight },
        ]}
      >
        <Text style={styles.emoji}>{data.emoji}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {data.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {data.subtitle}
        </Text>
      </View>
      <Text style={styles.meta}>{data.meta}</Text>
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
  },
  // Matches listItemImageContainerCompact from listStyles.ts
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
    flexShrink: 0,
  },
  emoji: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  meta: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
}));
