/**
 * Smoke tests for constant modules.
 * Verifies they export expected values and structures.
 */

import { SHEET, SLIDE_PRESETS } from '../animations';
import { SKILL_LEVELS, DIETARY_LIMITS, knownSkillLevel } from '#domain/dietary';
import { CookingSkillLevel } from '#/graphql/generated/schemaTypes';
import { Platform } from 'react-native';
import {
  getTabBarBottomOffset,
  getTabBarBottomPadding,
  getScrollClearancePadding,
  TAB_BAR_HEIGHT,
} from '../layout';
import { motion } from '#/theme/foundations/motion';

describe('animations constants', () => {
  it('exports spring presets with expected keys', () => {
    expect(motion.spring.DEFAULT).toBeDefined();
    expect(motion.spring.SNAPPY).toBeDefined();
    expect(motion.spring.PRESS).toBeDefined();
    expect(motion.spring.GENTLE).toBeDefined();
    expect(motion.spring.HEAVY).toBeDefined();
    expect(motion.spring.EXPAND).toBeDefined();
    expect(motion.spring.DEFAULT.damping).toBe(15);
  });

  it('exports SHEET constants', () => {
    expect(SHEET.SLIDE_DISTANCE).toBe(300);
    expect(SHEET.BACKDROP_OPACITY).toBe(0.5);
  });

  it('exports timing presets', () => {
    expect(motion.timing.INSTANT).toBe(100);
    expect(motion.timing.FAST).toBe(150);
    expect(motion.timing.STANDARD).toBe(200);
    expect(motion.timing.MODERATE).toBe(250);
    expect(motion.timing.SLOW).toBe(300);
  });

  it('exports SLIDE_PRESETS', () => {
    expect(SLIDE_PRESETS.fullExit.slideDistance).toBe('screenWidth');
    expect(SLIDE_PRESETS.subtle.slideDistance).toBe(50);
    expect(SLIDE_PRESETS.exitWithFade.withOpacity).toBe(true);
  });
});

describe('dietary constants', () => {
  it('exports SKILL_LEVELS, least to most experienced', () => {
    expect(SKILL_LEVELS).toEqual([
      CookingSkillLevel.Beginner,
      CookingSkillLevel.Intermediate,
      CookingSkillLevel.Advanced,
      CookingSkillLevel.Expert,
    ]);
  });

  it('reads a Title-case level an older cache holds as no level', () => {
    expect(knownSkillLevel('Intermediate')).toBeNull();
    expect(knownSkillLevel(CookingSkillLevel.Expert)).toBe(
      CookingSkillLevel.Expert,
    );
  });

  it('exports DIETARY_LIMITS with expected ranges', () => {
    expect(DIETARY_LIMITS.prepTime).toEqual({ min: 0, max: 480 });
    expect(DIETARY_LIMITS.calories).toEqual({ min: 0, max: 10000 });
    expect(DIETARY_LIMITS.protein).toEqual({ min: 0, max: 500 });
  });
});

describe('layout', () => {
  it('declares the tab bar height', () => {
    expect(TAB_BAR_HEIGHT).toBe(64);
  });

  describe('getTabBarBottomOffset', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // M3's floating toolbar sits `ScreenOffset` (16dp) above the inset; flush
    // on it, the bar sat 16dp lower than the spec whenever one was present.
    it('lifts the Android bar 16dp above the navigation-bar inset', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      expect(getTabBarBottomOffset(48)).toBe(64);
      expect(getTabBarBottomOffset(0)).toBe(16);
    });

    it('keeps the iOS bar partly inside the home-indicator inset', () => {
      expect(getTabBarBottomOffset(34)).toBeCloseTo(23.8);
      expect(getTabBarBottomOffset(0)).toBe(16);
    });
  });

  describe('getTabBarBottomPadding', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('clears the bar and the safe area, whichever reaches higher, by 16', () => {
      expect(getTabBarBottomPadding(0)).toBe(96);
      expect(getTabBarBottomPadding(34)).toBe(114);
      expect(getTabBarBottomPadding(20)).toBe(100);
    });

    it('clears the lifted Android bar', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      expect(getTabBarBottomPadding(48)).toBe(48 + 16 + TAB_BAR_HEIGHT + 16);
    });
  });

  describe('getScrollClearancePadding', () => {
    // Trailing slack for a scrolling list, which also has to pass under the
    // action button; a centred surface takes the bar padding instead, so the
    // two are separate functions rather than one with a flag.
    it('adds the floating button on top of the bar padding', () => {
      const button = 56 + 12;
      expect(getScrollClearancePadding(0)).toBe(96 + button);
      expect(getScrollClearancePadding(34)).toBe(114 + button);
    });

    it('is always the larger of the two', () => {
      expect(getScrollClearancePadding(20)).toBeGreaterThan(
        getTabBarBottomPadding(20),
      );
    });
  });
});
