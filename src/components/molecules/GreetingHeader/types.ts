import React from 'react';

/**
 * Configuration for the optional household badge
 * Only used in screens with home/household access (e.g., Pantry)
 */
export interface HouseholdBadgeConfig {
  /** Household/home name to display */
  name: string;
  /** Icon emoji (default: '🏠') */
  icon?: string;
  /** Callback when badge is pressed */
  onPress?: () => void;
}

/**
 * Configuration for the search bar
 */
export interface SearchConfig {
  /** Placeholder text */
  placeholder: string;
  /** Current search value */
  value: string;
  /** Callback when search text changes */
  onChangeText: (text: string) => void;
  /** Callback when clear button is pressed (optional, defaults to clearing text) */
  onClear?: () => void;
}

/**
 * Props for the GreetingHeader component
 */
export interface GreetingHeaderProps {
  // User info
  /** User's display name */
  userName: string;
  /** Initial letter for avatar fallback */
  avatarInitial?: string;
  /** URL for avatar image */
  avatarUrl?: string | null;
  /** Number to show in notification badge */
  notificationCount?: number;
  /** Callback when avatar is pressed */
  onAvatarPress?: () => void;

  // Optional household badge (Pantry only - has home access)
  /** Household badge configuration - omit for screens without home access */
  household?: HouseholdBadgeConfig;

  // Search bar
  /** Search bar configuration - omit to hide search */
  search?: SearchConfig;

  // Settings/action button
  /** Icon emoji for settings button (default: '⚙️') */
  settingsIcon?: string;
  /** Callback when settings button is pressed */
  onSettingsPress?: () => void;

  // Custom right actions (alternative to settings button)
  /** Custom right action elements (replaces settings icon) */
  rightActions?: React.ReactNode;

  // Styling
  /** Visual variant */
  variant?: 'default' | 'compact';
  /** Test ID prefix */
  testIDPrefix?: string;
}
