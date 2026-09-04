import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export interface NavigationAction {
  label: string;
  labelColor?: string;
  onPress: () => void;
  backgroundColor: string;
  icon?: React.ReactNode;
  iconVisible?: boolean;
  disabled?: boolean;
}

export interface OnboardingNavigationProps {
  showBackButton: boolean;
  showContinueButton: boolean;
  showSkipButton?: boolean;
  backAction?: NavigationAction;
  continueAction: NavigationAction;
  skipAction?: NavigationAction;
  isLastStep?: boolean;
}

export interface NavigationButtonProps {
  action: NavigationAction;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}
