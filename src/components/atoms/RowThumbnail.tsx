import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#components/atoms/Icon';
import { commonStyles } from '#/styles/commonStyles';

interface RowThumbnailProps {
  /** Without one it is a placeholder tile of the same size, keeping rows aligned. */
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
}

/** A list row's leading image, at the compact size rows share. */
export const RowThumbnail: React.FC<RowThumbnailProps> = ({ uri, style }) => (
  <View style={[commonStyles.listItemImageContainerCompact, style]}>
    {uri ? (
      <CachedImage
        uri={uri}
        style={commonStyles.listItemImageCompact}
        displaySize={48}
      />
    ) : (
      <Icon name="image-outline" size={20} tone="textTertiary" />
    )}
  </View>
);
