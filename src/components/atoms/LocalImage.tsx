import React from 'react';
import {
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

export interface LocalImageProps {
  /** A `file://` or `content://` path — something already on this device. */
  uri?: string;
  /** A bundled asset (`require(...)`), for a logo or an illustration. */
  source?: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'center' | 'stretch';
  onLoad?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A picture already on the device — a picked file, a crop preview, a bundled
 * asset. `CachedImage` is the REMOTE-url wrapper; its cache and shimmer exist
 * for a fetch a local image does not do.
 */
export const LocalImage: React.FC<LocalImageProps> = ({
  uri,
  source,
  style,
  resizeMode = 'cover',
  onLoad,
  accessibilityLabel,
  testID,
}) => (
  <Image
    source={source ?? { uri }}
    style={style}
    resizeMode={resizeMode}
    onLoad={onLoad}
    accessibilityLabel={accessibilityLabel}
    accessible={accessibilityLabel != null}
    testID={testID}
  />
);
