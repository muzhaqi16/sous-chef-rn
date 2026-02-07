// https://uicolors.app/generate/fb923b
export const colors = {
  // Brand colors - using your existing palette
  jaffa: {
    '50': '#fff6ed',
    '100': '#ffebd5',
    '200': '#fdd3ab',
    '300': '#fcb375',
    '400': '#f98537',
    '500': '#f76818',
    '600': '#e84e0e',
    '700': '#c0390e',
    '800': '#992f13',
    '900': '#7b2813',
    '950': '#421108',
  },
  charade: {
    '50': '#f5f6f9',
    '100': '#e8e9f1',
    '200': '#d6d9e7',
    '300': '#b9bed7',
    '400': '#989fc2',
    '500': '#7f83b2',
    '600': '#6d6ea3',
    '700': '#636194',
    '800': '#55537a',
    '900': '#464563',
    '950': '#2c2b3b',
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

  // Pantry expiration colors - for item status display
  expiration: {
    expiredBg: '#FEF2F2',
    expiredBorder: '#FECACA',
    expiredText: '#DC2626',
    expiredIconBg: '#FEE2E2',
    warningText: '#EA580C',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
  },

  // Filter tab colors
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

  // Special colors
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.6)', // Default overlay - kept for backwards compatibility
} as const;
