// https://uicolors.app/generate/fb923b
export const colors = {
  // Brand colors - using your existing palette
  jaffa: {
    '50': '#fff7ed',
    '100': '#ffedd5',
    '200': '#fed7aa',
    '300': '#fdba74',
    '400': '#fb923b',
    '500': '#f97416',
    '600': '#ea590c',
    '700': '#c2420c',
    '800': '#9a3412',
    '900': '#7c2d12',
    '950': '#431407',
  },
  charade: {
    '50': '#f5f6f9',
    '100': '#e7e9f2',
    '200': '#d5d8e8',
    '300': '#b9bfd7',
    '400': '#979ec3',
    '500': '#7d82b4',
    '600': '#6b6ca5',
    '700': '#605f96',
    '800': '#54527b',
    '900': '#454464',
    '950': '#2c2b3c',
  },
  fuchsiaBlue: {
    '50': '#f6f3ff',
    '100': '#eee9fe',
    '200': '#dfd5ff',
    '300': '#c7b4fe',
    '400': '#ac89fc',
    '500': '#8d51f8',
    '600': '#8537f0',
    '700': '#7625dc',
    '800': '#631fb8',
    '900': '#521b97',
    '950': '#320f66',
  },
  seance: {
    '50': '#fef1ff',
    '100': '#fbe2ff',
    '200': '#f9c4ff',
    '300': '#f996ff',
    '400': '#f757ff',
    '500': '#f51aff',
    '600': '#f900ff',
    '700': '#d500d5',
    '800': '#ae00ac',
    '900': '#81027d',
    '950': '#61005e',
  },

  // Neutral colors
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    1000: '#000000',
  },

  // Semantic colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  danger: '#F44336',

  // Status colors - for invite states, task states, etc.
  status: {
    pending: '#FFA500',
    accepted: '#4CAF50',
    declined: '#F44336',
    expired: '#9E9E9E',
    active: '#2196F3',
    inactive: '#BDBDBD',
  },

  // Role-based colors - for user roles, permissions
  roles: {
    owner: '#FF6B35',
    admin: '#4CAF50',
    member: '#2196F3',
    guest: '#9E9E9E',
  },

  // Validation colors - for form inputs, error states
  validation: {
    error: '#F44336',
    errorText: '#D32F2F',
    errorBg: '#FFEBEE',
    errorBorder: '#EF5350',
    success: '#4CAF50',
    successBg: '#E8F5E9',
    warning: '#FF9800',
    warningBg: '#FFF3E0',
    info: '#2196F3',
    infoBg: '#E3F2FD',
  },

  // Pantry expiration colors (light mode canonical shape — dark-mode values
  // live in `darkExpiration` below). Both themes consume identical keys.
  expiration: {
    expiredBg: '#FEF2F2',
    expiredBorder: '#FECACA',
    expiredText: '#DC2626',
    expiredIconBg: '#FEE2E2',
    warningText: '#EA580C',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
  },

  // Filter tab colors (light mode canonical shape — dark-mode values live
  // in `darkFilterTab` below). Both themes consume identical keys.
  filterTab: {
    activeBg: '#F97316',
    activeText: '#FFFFFF',
    inactiveBg: '#F3F4F6',
    inactiveText: '#000000',
    filteredBg: '#FFF7ED', // Subtle orange tint for filtered state
    filteredText: '#EA580C', // Orange text for filtered state
    countBg: '#D1D5DB',
    countText: '#000000',
    activeCountBg: 'rgba(255,255,255,0.25)',
  },

  // Avatar gradient colors
  avatar: {
    gradientStart: '#F97316',
    gradientEnd: '#FB923C',
    shadow: 'rgba(249, 115, 22, 0.3)',
  },

  // Section header colors
  sectionHeader: {
    warningText: '#EA580C',
    defaultText: '#6B7280',
    actionText: '#F97316',
  },

  // Alert banner colors - for generic status banners
  alertBanner: {
    error: {
      bg: '#FEF2F2',
      border: '#FECACA',
      text: '#DC2626',
      iconBg: '#FEE2E2',
    },
    warning: {
      bg: '#FFFBEB',
      border: '#FDE68A',
      text: '#EA580C',
      iconBg: '#FEF3C7',
    },
    info: {
      bg: '#EFF6FF',
      border: '#BFDBFE',
      text: '#2563EB',
      iconBg: '#DBEAFE',
    },
    success: {
      bg: '#F0FDF4',
      border: '#BBF7D0',
      text: '#16A34A',
      iconBg: '#DCFCE7',
    },
  },

  // Overlay variations - for modals, backdrops
  overlays: {
    light: 'rgba(0, 0, 0, 0.3)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.6)',
    heavy: 'rgba(0, 0, 0, 0.8)',
  },

  // Action colors - for swipe actions and semantic interactions
  actions: {
    consume: { light: '#9C27B0', dark: '#BA68C8' },
    waste: { light: '#FF9800', dark: '#FFB74D' },
    restock: { light: '#4CAF50', dark: '#81C784' },
    purchase: { light: '#4CAF50', dark: '#81C784' },
    unpurchase: { light: '#FF9800', dark: '#FFB74D' },
    favorite: { light: '#E91E63', dark: '#F48FB1' },
    rating: { light: '#FFB800', dark: '#FFD54F' },
  },

  // Special colors
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.6)', // Default overlay - kept for backwards compatibility
};

// Dark-mode override values for `colors.expiration`. Solid colors (no alpha)
// to prevent swipeable container background bleed-through.
export const darkExpiration: typeof colors.expiration = {
  expiredBg: '#3D2A2A',
  expiredBorder: '#5C3A3A',
  expiredText: '#FCA5A5',
  expiredIconBg: '#4A3030',
  warningText: '#FDBA74',
  warningBg: '#3D3225',
  warningBorder: '#5C4A35',
};

// Dark-mode override values for `colors.filterTab`. Keys that don't change
// between themes (e.g. `activeBg`, `activeText`, `activeCountBg`) reuse the
// canonical light-mode values from `colors.filterTab`.
export const darkFilterTab: typeof colors.filterTab = {
  activeBg: colors.filterTab.activeBg,
  activeText: colors.filterTab.activeText,
  inactiveBg: '#3F4553',
  inactiveText: '#D1D5DB',
  filteredBg: 'rgba(249, 115, 22, 0.15)',
  filteredText: '#FB923C',
  countBg: '#4B5563',
  countText: '#D1D5DB',
  activeCountBg: colors.filterTab.activeCountBg,
};
