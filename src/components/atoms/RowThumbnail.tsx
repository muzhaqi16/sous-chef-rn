import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CachedImage } from '#components/atoms/CachedImage';
import { commonStyles } from '#/styles/commonStyles';

interface RowThumbnailProps {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * A list row's leading photo, at the compact size rows share. Without a photo
 * it draws nothing: no placeholder, no stand-in icon.
 */
export const RowThumbnail: React.FC<RowThumbnailProps> = ({ uri, style }) =>
  uri ? (
    <View style={[commonStyles.listItemImageContainerCompact, style]}>
      <CachedImage
        uri={uri}
        style={commonStyles.listItemImageCompact}
        displaySize={48}
      />
    </View>
  ) : null;
