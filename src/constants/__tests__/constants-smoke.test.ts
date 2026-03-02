/**
 * Smoke tests for constant modules.
 * Verifies they export expected values and structures.
 */

import { SPRING, SHEET, TIMING, SLIDE_PRESETS, staggeredEntryAnimation, screenEntryAnimation, listItemExitAnimation, listItemFastExitAnimation, listItemEntryAnimation } from '../animations';
import { DRAG_ITEM_HEIGHT, DRAG_SCALE, DRAG_SHADOW_OPACITY, ITEM_VERTICAL_MARGIN, LONG_PRESS_DURATION, EDGE_THRESHOLD, MAX_SCROLL_SPEED } from '../drag';
import { DRAG_ACTIVATION_DISTANCE, DRAG_DISABLED_DISTANCE, MAX_NESTED_LIST_HEIGHT } from '../gestures';
import { SKILL_LEVELS, DIETARY_LIMITS } from '../dietary';
import { LANGUAGE_OPTIONS } from '../languages';
import { MESSAGES } from '../messages';
import { PLACEHOLDERS } from '../placeholders';
import { FRAGMENT_NAMES, ICONS, LABELS, EMPTY_STATE_MESSAGES, PAGINATION, DEFAULTS } from '../shoppingList';
import { HIT_SLOP, HIT_SLOP_SM, HIT_SLOP_LG } from '../touch';
import { getTabBarBottomPadding } from '../layout';

describe('animations constants', () => {
  it('exports SPRING presets with expected keys', () => {
    expect(SPRING.DEFAULT).toBeDefined();
    expect(SPRING.SNAPPY).toBeDefined();
    expect(SPRING.PRESS).toBeDefined();
    expect(SPRING.GENTLE).toBeDefined();
    expect(SPRING.HEAVY).toBeDefined();
    expect(SPRING.EXPAND).toBeDefined();
    expect(SPRING.DEFAULT.damping).toBe(15);
  });

  it('exports SHEET constants', () => {
    expect(SHEET.SLIDE_DISTANCE).toBe(300);
    expect(SHEET.BACKDROP_OPACITY).toBe(0.5);
  });

  it('exports TIMING presets', () => {
    expect(TIMING.INSTANT).toBe(100);
    expect(TIMING.FAST).toBe(150);
    expect(TIMING.STANDARD).toBe(200);
    expect(TIMING.MODERATE).toBe(250);
    expect(TIMING.SLOW).toBe(300);
  });

  it('exports SLIDE_PRESETS', () => {
    expect(SLIDE_PRESETS.fullExit.slideDistance).toBe('screenWidth');
    expect(SLIDE_PRESETS.subtle.slideDistance).toBe(50);
    expect(SLIDE_PRESETS.exitWithFade.withOpacity).toBe(true);
  });

  it('exports staggeredEntryAnimation', () => {
    expect(staggeredEntryAnimation.maxItems).toBe(6);
    expect(staggeredEntryAnimation.initialDelay).toBe(30);
  });

  it('exports screenEntryAnimation', () => {
    expect(screenEntryAnimation.delayPerItem).toBe(50);
    expect(screenEntryAnimation.maxItems).toBe(5);
  });

  it('exports listItemExitAnimation', () => {
    expect(listItemExitAnimation.slide.duration).toBe(300);
    expect(listItemExitAnimation.removalDelay).toBe(300);
  });

  it('exports listItemFastExitAnimation', () => {
    expect(listItemFastExitAnimation.slide.duration).toBe(200);
    expect(listItemFastExitAnimation.removalDelay).toBe(200);
  });

  it('exports listItemEntryAnimation', () => {
    expect(listItemEntryAnimation.fade.duration).toBe(250);
    expect(listItemEntryAnimation.slide.distance).toBe(50);
  });
});

describe('drag constants', () => {
  it('exports expected values', () => {
    expect(DRAG_ITEM_HEIGHT).toBe(95);
    expect(DRAG_SCALE).toBe(1.03);
    expect(DRAG_SHADOW_OPACITY).toBe(0.25);
    expect(ITEM_VERTICAL_MARGIN).toBe(8);
    expect(LONG_PRESS_DURATION).toBe(200);
    expect(EDGE_THRESHOLD).toBe(80);
    expect(MAX_SCROLL_SPEED).toBe(10);
  });
});

describe('gestures constants', () => {
  it('exports expected values', () => {
    expect(DRAG_ACTIVATION_DISTANCE).toBe(20);
    expect(DRAG_DISABLED_DISTANCE).toBe(Number.MAX_SAFE_INTEGER);
    expect(MAX_NESTED_LIST_HEIGHT).toBe(600);
  });
});

describe('dietary constants', () => {
  it('exports SKILL_LEVELS', () => {
    expect(SKILL_LEVELS).toEqual(['Beginner', 'Intermediate', 'Advanced', 'Expert']);
  });

  it('exports DIETARY_LIMITS with expected ranges', () => {
    expect(DIETARY_LIMITS.prepTime).toEqual({ min: 0, max: 480 });
    expect(DIETARY_LIMITS.calories).toEqual({ min: 0, max: 10000 });
    expect(DIETARY_LIMITS.protein).toEqual({ min: 0, max: 500 });
  });
});

describe('languages constants', () => {
  it('exports LANGUAGE_OPTIONS', () => {
    expect(LANGUAGE_OPTIONS).toEqual([{ label: 'English', value: 'en' }]);
  });
});

describe('messages constants', () => {
  it('exports MESSAGES with expected sections', () => {
    expect(MESSAGES.errors).toBeDefined();
    expect(MESSAGES.success).toBeDefined();
    expect(MESSAGES.loading).toBeDefined();
    expect(MESSAGES.confirmations).toBeDefined();
    expect(MESSAGES.labels).toBeDefined();
    expect(MESSAGES.instructions).toBeDefined();
    expect(MESSAGES.status).toBeDefined();
    expect(MESSAGES.empty).toBeDefined();
  });

  it('has expected error messages', () => {
    expect(MESSAGES.errors.networkError).toBe('Network error. Please check your connection.');
    expect(MESSAGES.errors.loginFailed).toContain('Login failed');
  });

  it('has expected label values', () => {
    expect(MESSAGES.labels.save).toBe('Save');
    expect(MESSAGES.labels.cancel).toBe('Cancel');
  });
});

describe('placeholders constants', () => {
  it('exports PLACEHOLDERS with expected fields', () => {
    expect(PLACEHOLDERS.email).toBe('Enter email');
    expect(PLACEHOLDERS.password).toBe('Enter password');
    expect(PLACEHOLDERS.search).toBeDefined();
    expect(PLACEHOLDERS.itemName).toBe('Enter item name');
  });
});

describe('shoppingList constants', () => {
  it('exports FRAGMENT_NAMES', () => {
    expect(FRAGMENT_NAMES.ITEM_VERSION_DATA).toBe('ItemVersionData');
  });

  it('exports ICONS', () => {
    expect(ICONS.ADD).toBe('add');
    expect(ICONS.SCANNER).toBe('barcode-scan');
  });

  it('exports LABELS', () => {
    expect(LABELS.ADD_ITEM).toBe('Add Item');
    expect(LABELS.NO_LISTS).toBe('No Shopping Lists');
  });

  it('exports EMPTY_STATE_MESSAGES', () => {
    expect(EMPTY_STATE_MESSAGES.NO_LISTS_TITLE).toBe('No Shopping Lists');
  });

  it('exports PAGINATION', () => {
    expect(PAGINATION.ITEMS_PAGE_SIZE).toBe(20);
  });

  it('exports DEFAULTS', () => {
    expect(DEFAULTS.SKELETON_COUNT).toBe(5);
    expect(DEFAULTS.REFRESH_DELAY).toBe(300);
  });
});

describe('touch constants', () => {
  it('exports HIT_SLOP with all sides', () => {
    expect(HIT_SLOP).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
  });

  it('exports HIT_SLOP_SM', () => {
    expect(HIT_SLOP_SM).toEqual({ top: 4, bottom: 4, left: 4, right: 4 });
  });

  it('exports HIT_SLOP_LG', () => {
    expect(HIT_SLOP_LG).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });
  });
});

describe('layout', () => {
  describe('getTabBarBottomPadding', () => {
    it('calculates bottom padding from safe area', () => {
      // TAB_BAR_HEIGHT (65) + safeBottom + 16
      expect(getTabBarBottomPadding(0)).toBe(81);
      expect(getTabBarBottomPadding(34)).toBe(115);
      expect(getTabBarBottomPadding(20)).toBe(101);
    });
  });
});
