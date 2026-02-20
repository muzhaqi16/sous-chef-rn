/**
 * Avatar Component
 *
 * Displays a user avatar with fallback to initials or icon
 */

import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {CachedImage} from '#components/atoms/CachedImage';
import {Icon} from '#utils/iconUtils';
import {getInitials} from '#utils/ownershipHelpers';

interface AvatarProps {
  /** Avatar image URL */
  uri?: string | null;
  /** Display name for initials fallback */
  name?: string | null;
  /** Size of avatar in pixels */
  size?: number;
  /** Icon to show if no image/name available */
  fallbackIcon?: string;
  /** Icon library for fallback icon */
  fallbackIconLibrary?: string;
  /** Background color override */
  backgroundColor?: string;
  /** Text color override */
  textColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 40,
  fallbackIcon = 'person',
  fallbackIconLibrary,
  backgroundColor,
  textColor,
}) => {
  const {theme} = useUnistyles();

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const fontSize = size * 0.4; // 40% of container size

  // Show image if URI is provided (CachedImage handles error fallback internally)
  if (uri) {
    return (
      <View style={[styles.container, containerStyle]}>
        <CachedImage
          uri={uri}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      </View>
    );
  }

  // Show initials if name is provided
  if (name) {
    const initials = getInitials(name);
    return (
      <View
        style={[
          styles.container,
          styles.initialsContainer,
          containerStyle,
          backgroundColor && {backgroundColor},
        ]}>
        <Text
          style={[
            styles.initials,
            {fontSize},
            textColor && {color: textColor},
          ]}>
          {initials}
        </Text>
      </View>
    );
  }

  // Fallback to icon
  return (
    <View
      style={[
        styles.container,
        styles.iconContainer,
        containerStyle,
        backgroundColor && {backgroundColor},
      ]}>
      <Icon
        name={fallbackIcon}
        size={size * 0.6}
        color={textColor || theme.colors.textSecondary}
        library={fallbackIconLibrary}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: theme.colors.primary + '20',
  },
  initialsContainer: {
    backgroundColor: theme.colors.primary + '20',
  },
  initials: {
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  iconContainer: {
    backgroundColor: theme.colors.background,
  },
}));
