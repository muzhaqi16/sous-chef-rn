'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { ImageCropScreen } from '../ImageCropScreen';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockGoBack = jest.fn();
jest.mock('#hooks/navigation/useSafeNavigation', () => ({
  useSafeNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

// Add Gesture.Pinch mock not included in global setup
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  const gestureChain = () => ({
    onStart: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
    onFinalize: jest.fn().mockReturnThis(),
    minDistance: jest.fn().mockReturnThis(),
    enabled: jest.fn().mockReturnThis(),
    averageTouches: jest.fn().mockReturnThis(),
    maxPointers: jest.fn().mockReturnThis(),
    minPointers: jest.fn().mockReturnThis(),
  });
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: require('react-native').FlatList,
    gestureHandlerRootHOC: jest.fn((c: any) => c),
    Directions: {},
    GestureHandlerRootView: View,
    Gesture: {
      Pinch: jest.fn(gestureChain),
      Pan: jest.fn(gestureChain),
      Tap: jest.fn(gestureChain),
      Simultaneous: jest.fn((...gestures: any[]) => gestures),
      Exclusive: jest.fn((...gestures: any[]) => gestures),
      Race: jest.fn((...gestures: any[]) => gestures),
    },
    GestureDetector: View,
  };
});

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title, onBack }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Pressable testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Text>{title}</Text>
      </View>
    );
  },
}));

jest.mock('#utils/imageValidation', () => ({
  MAX_PROFILE_SIZE: 5 * 1024 * 1024,
}));

jest.mock('@react-native-community/image-editor', () => ({
  __esModule: true,
  default: { cropImage: jest.fn().mockResolvedValue({ uri: 'cropped-uri' }) },
}));

jest.mock('#/storage/mmkv', () => ({
  storage: { set: jest.fn(), getString: jest.fn() },
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
jest.spyOn(Image, 'getSize').mockImplementation((uri: string, success: any) => {
  success(800, 600);
});

const defaultProps = {
  route: {
    params: {
      imageFile: {
        uri: 'file://test-image.jpg',
        fileName: 'test.jpg',
        fileSize: 500000,
        type: 'image/jpeg',
      },
    },
  },
} as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ImageCropScreen', () => {
  it('renders crop photo title', () => {
    const { getAllByText } = render(<ImageCropScreen {...defaultProps} />);
    // Title and button both have 'Crop Photo' text
    expect(getAllByText('Crop Photo').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading instructions initially', () => {
    const { getByText } = render(<ImageCropScreen {...defaultProps} />);
    expect(getByText('Loading image...')).toBeTruthy();
  });

  it('renders crop button', () => {
    const { getAllByText } = render(<ImageCropScreen {...defaultProps} />);
    // The button and header both say 'Crop Photo'
    expect(getAllByText('Crop Photo').length).toBeGreaterThanOrEqual(2);
  });

  it('renders back button', () => {
    const { getByTestId } = render(<ImageCropScreen {...defaultProps} />);
    expect(getByTestId('back-button')).toBeTruthy();
  });

  it('navigates back when back pressed', () => {
    const { getByTestId } = render(<ImageCropScreen {...defaultProps} />);
    fireEvent.press(getByTestId('back-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
