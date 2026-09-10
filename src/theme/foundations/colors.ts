// https://uicolors.app/generate/fb923b
/**
 * The brand ramp. 500 is the solid mid-point of the design's brand gradient
 * (`#FA8637` → `#F17F31` at 95.27deg). Hoisted out of `colors` so the tokens
 * below that copy a brand shade can name it.
 */
const jaffa = {
  '50': '#fff7ed',
  '100': '#ffedd5',
  '200': '#fed7aa',
  '300': '#fdba74',
  '400': '#fb923b',
  '500': '#f58234',
  '600': '#ea590c',
  '700': '#c2420c',
  '800': '#9a3412',
  '900': '#7c2d12',
  '950': '#431407',
};

export const colors = {
  jaffa,
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

  // Warm-tuned neutral ramp, very low chroma, so neutrals harmonize with the warm
  // orange brand. Text tones are picked for WCAG AA on the warm-white background:
  // 900 = textPrimary (~14:1), 700 = textSecondary (~7.5:1),
  // 600 = textTertiary (~5.4:1), 500 = placeholder (~3.6:1).
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

  // Aligned with the hues used by expiration/alertBanner/validation below.
  // `warning` is amber, deliberately distinct from the brand orange.
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  danger: '#DC2626',

  status: {
    pending: '#D97706',
    accepted: '#16A34A',
    declined: '#DC2626',
    expired: '#9E9E9E',
    active: '#2563EB',
    inactive: '#BDBDBD',
  },

  roles: {
    owner: '#EA580C',
    admin: '#16A34A',
    member: '#2563EB',
    guest: '#9E9E9E',
  },

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

  // Light-mode canonical shape; `darkExpiration` below mirrors the keys exactly.
  expiration: {
    expiredBg: '#FEF2F2',
    expiredBorder: '#FECACA',
    expiredText: '#DC2626',
    expiredIconBg: '#FEE2E2',
    warningText: '#EA580C',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
  },

  // Light-mode canonical shape; `darkFilterTab` below mirrors the keys exactly.
  filterTab: {
    // Mirrors what `applyAppearance` derives for a custom brand, so the default
    // theme and an overridden one shade the tab the same way.
    activeBg: jaffa['500'],
    // White, matching a primary button. Below AA on this orange; see `onBrand`.
    activeText: '#FFFFFF',
    inactiveBg: '#F3F4F6',
    inactiveText: '#000000',
    filteredBg: jaffa['50'],
    filteredText: jaffa['600'],
    countBg: '#D1D5DB',
    countText: '#000000',
    activeCountBg: 'rgba(255,255,255,0.25)',
  },

  avatar: {
    gradientStart: jaffa['500'],
    gradientEnd: jaffa['400'],
    shadow: 'rgba(245, 130, 52, 0.3)',
  },

  sectionHeader: {
    warningText: '#EA580C',
    defaultText: '#6B7280',
    actionText: jaffa['500'],
  },

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

  overlays: {
    light: 'rgba(0, 0, 0, 0.3)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.6)',
    heavy: 'rgba(0, 0, 0, 0.8)',
  },

  actions: {
    consume: { light: '#9333EA', dark: '#C084FC' },
    waste: { light: '#D97706', dark: '#FBBF24' },
    restock: { light: '#16A34A', dark: '#4ADE80' },
    purchase: { light: '#16A34A', dark: '#4ADE80' },
    unpurchase: { light: '#D97706', dark: '#FBBF24' },
    favorite: { light: '#E11D48', dark: '#FB7185' },
    rating: { light: '#F59E0B', dark: '#FCD34D' },
  },

  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.6)', // Default overlay - kept for backwards compatibility
};

// Dark overrides for `colors.expiration`. Solid, no alpha, or the swipeable
// container's background bleeds through.
export const darkExpiration: typeof colors.expiration = {
  expiredBg: '#3D2A2A',
  expiredBorder: '#5C3A3A',
  expiredText: '#FCA5A5',
  expiredIconBg: '#4A3030',
  warningText: '#FDBA74',
  warningBg: '#3D3225',
  warningBorder: '#5C4A35',
};

// Dark overrides for `colors.filterTab`; unchanged keys reuse the light values.
export const darkFilterTab: typeof colors.filterTab = {
  activeBg: colors.filterTab.activeBg,
  activeText: colors.filterTab.activeText,
  // Warm neutral chips, matching the dark theme's other surfaces — slate-blue
  // reads cool against the warm near-black background.
  inactiveBg: colors.neutral[700],
  inactiveText: colors.neutral[200],
  filteredBg: 'rgba(251, 146, 59, 0.15)',
  filteredText: jaffa['300'],
  countBg: colors.neutral[600],
  countText: colors.neutral[100],
  activeCountBg: colors.filterTab.activeCountBg,
};

// The categorical ramp a chart assigns by CATEGORY, not by magnitude. Each step
// is opaque and separated from its neighbours and from `primary`, which the
// chart puts first so a rebrand reaches it. The dark steps are their own —
// pastels that read on white go muddy on charcoal.
export const chartCategorical = [
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#F4A261',
  '#8E7DBE',
];

export const darkChartCategorical: typeof chartCategorical = [
  '#2DD4BF',
  '#38BDF8',
  '#4ADE80',
  '#FACC15',
  '#E879F9',
  '#FB923C',
  '#A78BFA',
];
