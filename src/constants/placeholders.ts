/**
 * Centralized placeholder constants for input fields
 * Use these constants instead of hardcoding placeholder text
 */

export const PLACEHOLDERS = {
  // Authentication
  email: 'Enter email',
  password: 'Enter password',
  confirmPassword: 'Confirm password',
  username: 'Enter username',
  verificationCode: 'Enter verification code',

  // Search
  search: 'Search…',
  searchItems: 'Search items…',
  searchProducts: 'Search products…',
  searchMembers: 'Search members…',

  // Home
  homeName: 'Enter home name',
  homeDescription: 'Enter home description',

  // Item details
  itemName: 'Enter item name',
  itemDescription: 'Enter description',
  quantity: 'Enter quantity',
  brand: 'Enter brand',
  category: 'Select category',
  location: 'Select location',
  notes: 'Add notes',

  // Profile
  firstName: 'Enter first name',
  lastName: 'Enter last name',
  displayName: 'Enter display name',
  bio: 'Tell us about yourself',
  phoneNumber: 'Enter phone number',
  url: 'Enter URL',

  // Invitations
  inviteEmail: 'Enter email address to invite',
  inviteMessage: 'Add a personal message (optional)',

  // Shopping list
  addItem: 'Add item to shopping list',
  quickAdd: 'Quick add…',

  // Date and time
  selectDate: 'Select date',
  expiryDate: 'Select expiry date',
  purchaseDate: 'Select purchase date',

  // Units
  unit: 'Select unit',
  customUnit: 'Enter custom unit',

  // General
  optional: '(optional)',
  required: '(required)',
} as const;
