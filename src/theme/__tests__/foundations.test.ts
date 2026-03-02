import { colors } from '../foundations/colors';
import { spacing, space } from '../foundations/spacing';
import { typography, fonts } from '../foundations/typography';
import { radii } from '../foundations/radii';
import { shadows } from '../foundations/shadows';
import { sizes } from '../foundations/sizes';
import { zIndex } from '../foundations/zIndex';
import { breakpoints } from '../foundations/breakpoints';

describe('theme foundations', () => {
  describe('colors', () => {
    it('exports jaffa color palette', () => {
      expect(colors.jaffa).toBeDefined();
      expect(colors.jaffa['50']).toBe('#fff6ed');
      expect(colors.jaffa['400']).toBe('#f98537');
      expect(colors.jaffa['950']).toBe('#421108');
    });

    it('exports charade color palette', () => {
      expect(colors.charade).toBeDefined();
      expect(colors.charade['50']).toBe('#f5f6f9');
    });

    it('exports neutral color palette', () => {
      expect(colors.neutral).toBeDefined();
      expect(colors.neutral[0]).toBe('#FFFFFF');
      expect(colors.neutral[1000]).toBe('#000000');
    });

    it('exports semantic colors', () => {
      expect(colors.success).toBe('#4CAF50');
      expect(colors.warning).toBe('#FF9800');
      expect(colors.error).toBe('#F44336');
      expect(colors.info).toBe('#2196F3');
    });

    it('exports status colors', () => {
      expect(colors.status.pending).toBeDefined();
      expect(colors.status.accepted).toBeDefined();
      expect(colors.status.declined).toBeDefined();
    });

    it('exports role colors', () => {
      expect(colors.roles.owner).toBeDefined();
      expect(colors.roles.admin).toBeDefined();
      expect(colors.roles.member).toBeDefined();
      expect(colors.roles.guest).toBeDefined();
    });

    it('exports validation colors', () => {
      expect(colors.validation.error).toBeDefined();
      expect(colors.validation.errorBg).toBeDefined();
      expect(colors.validation.successBg).toBeDefined();
    });

    it('exports expiration colors for light and dark modes', () => {
      expect(colors.expiration.expiredBg).toBeDefined();
      expect(colors.expiration.darkExpiredBg).toBeDefined();
    });

    it('exports action colors with light and dark variants', () => {
      expect(colors.actions.consume.light).toBeDefined();
      expect(colors.actions.consume.dark).toBeDefined();
      expect(colors.actions.purchase.light).toBeDefined();
    });

    it('exports overlay and transparent', () => {
      expect(colors.overlay).toBe('rgba(0, 0, 0, 0.6)');
      expect(colors.transparent).toBe('transparent');
    });

    it('exports alert banner colors', () => {
      expect(colors.alertBanner.error.bg).toBeDefined();
      expect(colors.alertBanner.warning.bg).toBeDefined();
      expect(colors.alertBanner.info.bg).toBeDefined();
      expect(colors.alertBanner.success.bg).toBeDefined();
    });
  });

  describe('spacing', () => {
    it('exports spacing scale', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(16);
      expect(spacing.lg).toBe(24);
      expect(spacing.xl).toBe(32);
      expect(spacing['2xl']).toBe(48);
      expect(spacing['3xl']).toBe(64);
    });

    it('exports intermediate spacing values', () => {
      expect(spacing['2.5']).toBe(10);
      expect(spacing['3']).toBe(12);
      expect(spacing['5']).toBe(20);
    });
  });

  describe('space helper', () => {
    it('returns array of spacing values for given keys', () => {
      expect(space('xs', 'md', 'lg')).toEqual([4, 16, 24]);
    });

    it('returns empty array for no arguments', () => {
      expect(space()).toEqual([]);
    });

    it('returns single value', () => {
      expect(space('sm')).toEqual([8]);
    });
  });

  describe('typography', () => {
    it('exports font families', () => {
      expect(typography.fontFamily.regular).toBe('System');
      expect(typography.fontFamily.bold).toBe('System-Bold');
      expect(typography.fontFamily.mono).toBe('Courier');
    });

    it('exports font sizes', () => {
      expect(typography.fontSize.xs).toBe(12);
      expect(typography.fontSize.sm).toBe(14);
      expect(typography.fontSize.base).toBe(16);
      expect(typography.fontSize.md).toBe(16); // alias
      expect(typography.fontSize.lg).toBe(18);
      expect(typography.fontSize['5xl']).toBe(40);
    });

    it('exports line heights', () => {
      expect(typography.lineHeight.tight).toBe(20);
      expect(typography.lineHeight.normal).toBe(24);
      expect(typography.lineHeight.relaxed).toBe(28);
      expect(typography.lineHeight.loose).toBe(32);
    });

    it('exports letter spacing', () => {
      expect(typography.letterSpacing.tight).toBe(-0.5);
      expect(typography.letterSpacing.normal).toBe(0);
      expect(typography.letterSpacing.wide).toBe(0.5);
    });
  });

  describe('fonts', () => {
    it('exports font sizes from typography', () => {
      expect(fonts.size).toBe(typography.fontSize);
    });

    it('exports font weights as strings', () => {
      expect(fonts.weight.regular).toBe('400');
      expect(fonts.weight.medium).toBe('500');
      expect(fonts.weight.semibold).toBe('600');
      expect(fonts.weight.bold).toBe('700');
    });

    it('exports lineHeight from typography', () => {
      expect(fonts.lineHeight).toBe(typography.lineHeight);
    });

    it('exports letterSpacing from typography', () => {
      expect(fonts.letterSpacing).toBe(typography.letterSpacing);
    });
  });

  describe('radii', () => {
    it('exports border radius scale', () => {
      expect(radii.none).toBe(0);
      expect(radii.xs).toBe(2);
      expect(radii.sm).toBe(4);
      expect(radii.md).toBe(8);
      expect(radii.lg).toBe(12);
      expect(radii.xl).toBe(16);
      expect(radii['4xl']).toBe(28);
      expect(radii.pill).toBe(9999);
      expect(radii.full).toBe(9999);
    });
  });

  describe('shadows', () => {
    it('exports shadow presets', () => {
      expect(shadows.none).toEqual({});
      expect(shadows.sm.elevation).toBe(2);
      expect(shadows.md.elevation).toBe(4);
      expect(shadows.lg.elevation).toBe(8);
      expect(shadows.xl.elevation).toBe(12);
    });

    it('each shadow (except none) has expected properties', () => {
      const levels = [shadows.sm, shadows.md, shadows.lg, shadows.xl];
      for (const shadow of levels) {
        expect(shadow.shadowColor).toBe('#000');
        expect(shadow.shadowOffset).toBeDefined();
        expect(typeof shadow.shadowOpacity).toBe('number');
        expect(typeof shadow.shadowRadius).toBe('number');
        expect(typeof shadow.elevation).toBe('number');
      }
    });

    it('shadow opacity increases with severity', () => {
      expect(shadows.sm.shadowOpacity).toBeLessThan(shadows.md.shadowOpacity);
      expect(shadows.md.shadowOpacity).toBeLessThan(shadows.lg.shadowOpacity);
      expect(shadows.lg.shadowOpacity).toBeLessThan(shadows.xl.shadowOpacity);
    });
  });

  describe('sizes', () => {
    it('exports button sizes', () => {
      expect(sizes.button.sm).toBe(32);
      expect(sizes.button.md).toBe(44);
      expect(sizes.button.lg).toBe(56);
    });

    it('exports avatar sizes', () => {
      expect(sizes.avatar.xs).toBe(24);
      expect(sizes.avatar.xl).toBe(64);
    });

    it('exports icon sizes', () => {
      expect(sizes.icon.sm).toBe(20);
      expect(sizes.icon.md).toBe(24);
      expect(sizes.icon.lg).toBe(32);
    });

    it('exports touch target sizes (minimum 44 for accessibility)', () => {
      expect(sizes.touchTarget.min).toBe(44);
      expect(sizes.touchTarget.md).toBe(44);
    });

    it('exports FAB sizes', () => {
      expect(sizes.fab.sm).toBe(48);
      expect(sizes.fab.md).toBe(56);
    });

    it('exports itemCard sizes', () => {
      expect(sizes.itemCard.compact.image).toBe(48);
      expect(sizes.itemCard.standard.image).toBe(60);
    });
  });

  describe('zIndex', () => {
    it('exports z-index layers in ascending order', () => {
      expect(zIndex.hide).toBe(-1);
      expect(zIndex.base).toBe(0);
      expect(zIndex.dropdown).toBe(100);
      expect(zIndex.sticky).toBe(200);
      expect(zIndex.fixed).toBe(300);
      expect(zIndex.modalBackdrop).toBe(400);
      expect(zIndex.modal).toBe(500);
      expect(zIndex.popover).toBe(600);
      expect(zIndex.tooltip).toBe(700);
      expect(zIndex.fab).toBe(800);
      expect(zIndex.toast).toBe(900);
      expect(zIndex.overlay).toBe(1000);
    });

    it('layers are ordered correctly (each layer is higher than the previous)', () => {
      const layers = [
        zIndex.base,
        zIndex.dropdown,
        zIndex.sticky,
        zIndex.fixed,
        zIndex.modalBackdrop,
        zIndex.modal,
        zIndex.popover,
        zIndex.tooltip,
        zIndex.fab,
        zIndex.toast,
        zIndex.overlay,
      ];
      for (let i = 1; i < layers.length; i++) {
        expect(layers[i]).toBeGreaterThan(layers[i - 1]);
      }
    });
  });

  describe('breakpoints', () => {
    it('exports breakpoint values', () => {
      expect(breakpoints.xs).toBe(0);
      expect(breakpoints.sm).toBe(576);
      expect(breakpoints.md).toBe(768);
      expect(breakpoints.lg).toBe(992);
      expect(breakpoints.xl).toBe(1200);
      expect(breakpoints.superLarge).toBe(2000);
      expect(breakpoints.tvLike).toBe(4000);
    });

    it('breakpoints are in ascending order', () => {
      const values = [
        breakpoints.xs,
        breakpoints.sm,
        breakpoints.md,
        breakpoints.lg,
        breakpoints.xl,
        breakpoints.superLarge,
        breakpoints.tvLike,
      ];
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });
  });
});
