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

  // Neutral colors — warm-tuned ramp (subtle taupe undertone, very low chroma)
  // so neutrals harmonize with the warm orange brand instead of fighting it.
  // Lightness ordering is preserved 1:1 with the previous cool ramp, so every
  // existing semantic mapping keeps its relative contrast. Text tones picked
  // for WCAG AA on the warm-white app background:
  //   900 = textPrimary (~14:1), 700 = textSecondary (~7.5:1),
  //   600 = textTertiary (~5.4:1), 500 = placeholder (~3.6:1).
  neutral: {
    0: '#FFFFFF',
    50: '#FAF9F7', // warm off-white — app background
    100: '#F3F1ED', // surfaceVariant / pressed
    200: '#E9E6E0', // borderLight / divider
    300: '#DAD6CD', // border
    400: '#BBB6AC', // disabled
    500: '#847F76', // placeholder
    600: '#696459', // textTertiary
    700: '#514D45', // textSecondary
    800: '#36332C', // elevated dark surface
    900: '#211E18', // textPrimary / warm near-black
    1000: '#000000',
  },

  // Semantic colors — 2026 harmonized set, aligned with the modern hues already
  // used by expiration/alertBanner/validation below (green-600 / amber-600 /
  // red-600 / blue-600). Brand orange (jaffa) + warm neutrals are unchanged.
  // warning is amber, deliberately distinct from the brand orange.
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  danger: '#DC2626',

  // Status colors - for invite states, task states, etc.
  status: {
    pending: '#D97706',
    accepted: '#16A34A',
    declined: '#DC2626',
    expired: '#9E9E9E',
    active: '#2563EB',
    inactive: '#BDBDBD',
  },

  // Role-based colors - for user roles, permissions
  roles: {
    owner: '#EA580C',
    admin: '#16A34A',
    member: '#2563EB',
    guest: '#9E9E9E',
  },

  // Validation colors - for form inputs, error states
  validation: {
    error: '#DC2626',
    errorText: '#B91C1C',
    errorBg: '#FEF2F2',
    errorBorder: '#EF4444',
    success: '#16A34A',
    successBg: '#F0FDF4',
    warning: '#D97706',
    warningBg: '#FFFBEB',
    info: '#2563EB',
    infoBg: '#EFF6FF',
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
    consume: { light: '#9333EA', dark: '#C084FC' },
    waste: { light: '#D97706', dark: '#FBBF24' },
    restock: { light: '#16A34A', dark: '#4ADE80' },
    purchase: { light: '#16A34A', dark: '#4ADE80' },
    unpurchase: { light: '#D97706', dark: '#FBBF24' },
    favorite: { light: '#E11D48', dark: '#FB7185' },
    rating: { light: '#F59E0B', dark: '#FCD34D' },
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
  // Warm neutral chips, matching the rest of the dark theme's surfaces. The
  // previous slate-blue values (#3F4553 / #4B5563 / #D1D5DB) read cool against
  // the warm near-black background and broke the "refined warm" direction.
  inactiveBg: colors.neutral[700],
  inactiveText: colors.neutral[200],
  filteredBg: 'rgba(249, 115, 22, 0.15)',
  filteredText: '#FB923C',
  countBg: colors.neutral[600],
  countText: colors.neutral[100],
  activeCountBg: colors.filterTab.activeCountBg,
};
