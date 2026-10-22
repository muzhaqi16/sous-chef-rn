import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CachedImage } from '#components/atoms/CachedImage';
import { commonStyles } from '#/styles/commonStyles';

interface RowThumbnailProps {
  uri: string;
  style?: StyleProp<ViewStyle>;
}

/** A list row's leading image, at the compact size rows share. */
export const RowThumbnail: React.FC<RowThumbnailProps> = ({ uri, style }) => (
  <View style={[commonStyles.listItemImageContainerCompact, style]}>
    <CachedImage
      uri={uri}
      style={commonStyles.listItemImageCompact}
      displaySize={48}
    />
  </View>
);
