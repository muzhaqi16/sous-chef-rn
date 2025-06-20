export type ThemeColors = {
  white: string;
  black: string;
  grey50: string;
  grey100: string;
  grey200: string;
  grey300: string;
  grey400: string;
  grey500: string;
  grey600: string;
  grey700: string;
  grey800: string;
  grey900: string;
  background: string;
  surface: string;
  border: string;
  overlay: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  placeholder: string;
  iconPrimary: string;
  iconSecondary: string;
  primary: string;
  onPrimary: string;
  primaryVariant: string;
  secondary: string;
  onSecondary: string;
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  error: string;
  onError: string;
  info: string;
  onInfo: string;
};
const common = {
  white: '#FFFFFF',
  black: '#000000',
  grey50: '#FAFAFA',
  grey100: '#F4EFF3',
  grey200: '#ECECEC',
  grey300: '#D1D1D1',
  grey400: '#999999',
  grey500: '#666666',
  grey600: '#333333',
  grey700: '#2E2E2E',
  grey800: '#1A1A1A',
  grey900: '#000000',
};

export const lightColors: ThemeColors = {
  ...common,

  // surfaces
  background: common.grey50,
  surface: common.white,
  border: common.grey200,
  overlay: 'rgba(0,0,0,0.5)',

  // text & icons
  textPrimary: common.grey900,
  textSecondary: common.grey600,
  textDisabled: common.grey400,
  placeholder: common.grey400,
  iconPrimary: common.grey700,
  iconSecondary: common.grey400,

  // brand
  primary: '#FF8A4C',
  onPrimary: common.white,
  primaryVariant: '#FFA559',
  secondary: '#2E86AB',
  onSecondary: common.white,

  // feedback/status
  success: '#28A745',
  onSuccess: common.white,
  warning: '#FFC107',
  onWarning: common.grey900,
  error: '#DC3545',
  onError: common.white,
  info: '#17A2B8',
  onInfo: common.white,
};

export const darkColors: ThemeColors = {
  ...common,

  // surfaces
  background: common.grey900,
  surface: common.grey800,
  border: common.grey700,
  overlay: 'rgba(255,255,255,0.2)',

  // text & icons
  textPrimary: common.grey50,
  textSecondary: common.grey200,
  textDisabled: common.grey400,
  placeholder: common.grey400,
  iconPrimary: common.grey100,
  iconSecondary: common.grey400,

  // brand
  primary: '#FF8A4C',
  onPrimary: common.white,
  primaryVariant: '#FFA559',
  secondary: '#2E86AB',
  onSecondary: common.white,

  // feedback/status
  success: '#28A745',
  onSuccess: common.white,
  warning: '#FFC107',
  onWarning: common.grey900,
  error: '#DC3545',
  onError: common.white,
  info: '#17A2B8',
  onInfo: common.white,
};
