import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { CachedImage } from '#components/atoms/CachedImage';
import type { CardLeftSlotProps } from './types';

/**
 * The row's thumbnail. With no image URL it renders a placeholder tile of the
 * same size and shape, so rows never collapse to a bare gap and stay aligned.
 */
export const CardLeftSlot: React.FC<CardLeftSlotProps> = ({ imageUrl }) => (
  <View
    style={[commonStyles.listItemImageContainerCompact, styles.imageContainer]}
  >
    {imageUrl ? (
      <CachedImage
        uri={imageUrl}
        style={commonStyles.listItemImageCompact}
        displaySize={48}
      />
    ) : (
      <Icon name="image-outline" size={20} tone="textTertiary" />
    )}
  </View>
);

const styles = StyleSheet.create({
  imageContainer: {
    overflow: 'hidden',
  },
});
