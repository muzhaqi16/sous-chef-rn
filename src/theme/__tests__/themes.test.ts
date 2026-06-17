import { lightTheme, darkTheme } from '../themes';
import type { Theme } from '../themes';

describe('themes', () => {
  describe('lightTheme', () => {
    it('exports a lightTheme object', () => {
      expect(lightTheme).toBeDefined();
    });

    it('has spacing', () => {
      expect(lightTheme.spacing).toBeDefined();
      expect(lightTheme.spacing.xs).toBe(4);
      expect(lightTheme.spacing.sm).toBe(8);
      expect(lightTheme.spacing.md).toBe(16);
      expect(lightTheme.spacing.lg).toBe(24);
      expect(lightTheme.spacing.xl).toBe(32);
    });

    it('has typography', () => {
      expect(lightTheme.typography).toBeDefined();
      expect(lightTheme.typography.fontSize.sm).toBe(14);
      expect(lightTheme.typography.fontSize.base).toBe(16);
    });

    it('has fonts', () => {
      expect(lightTheme.fonts).toBeDefined();
      expect(lightTheme.fonts.size).toBeDefined();
      expect(lightTheme.fonts.weight).toBeDefined();
      expect(lightTheme.fonts.weight.regular).toBe('400');
      expect(lightTheme.fonts.weight.bold).toBe('700');
    });

    it('has radii', () => {
      expect(lightTheme.radii).toBeDefined();
      expect(lightTheme.radii.none).toBe(0);
      expect(lightTheme.radii.md).toBe(8);
      expect(lightTheme.radii.pill).toBe(9999);
    });

    it('has shadows', () => {
      expect(lightTheme.shadows).toBeDefined();
      expect(lightTheme.shadows.none).toEqual({});
      expect(lightTheme.shadows.md.boxShadow).toEqual([
        {
          offsetX: 0,
          offsetY: 2,
          blurRadius: 8,
          spreadDistance: 0,
          color: 'rgba(0, 0, 0, 0.06)',
        },
      ]);
    });

    it('has sizes', () => {
      expect(lightTheme.sizes).toBeDefined();
      expect(lightTheme.sizes.button.md).toBe(44);
      expect(lightTheme.sizes.icon.md).toBe(24);
      expect(lightTheme.sizes.touchTarget.min).toBe(44);
    });

    it('has zIndex', () => {
      expect(lightTheme.zIndex).toBeDefined();
      expect(lightTheme.zIndex.base).toBe(0);
      expect(lightTheme.zIndex.modal).toBe(500);
      expect(lightTheme.zIndex.overlay).toBe(1000);
    });

    it('has opacity presets', () => {
      expect(lightTheme.opacity).toBeDefined();
      expect(lightTheme.opacity.pressed).toBe(0.7);
      expect(lightTheme.opacity.disabled).toBe(0.5);
    });

    it('has colors with light mode values', () => {
      expect(lightTheme.colors).toBeDefined();
      // Primary colors
      expect(lightTheme.colors.primary).toBeDefined();
      expect(lightTheme.colors.onPrimary).toBeDefined();
      // Background is a warm off-white in light mode (cards layer white above it)
      expect(lightTheme.colors.background).toBe('#F6F4F0');
      // Text should be dark in light mode (warm near-black)
      expect(lightTheme.colors.textPrimary).toBe('#211E18');
    });

    it('has semantic colors', () => {
      expect(lightTheme.colors.success).toBeDefined();
      expect(lightTheme.colors.warning).toBeDefined();
      expect(lightTheme.colors.error).toBeDefined();
      expect(lightTheme.colors.info).toBeDefined();
    });

    it('has icon colors', () => {
      expect(lightTheme.colors.iconPrimary).toBeDefined();
      expect(lightTheme.colors.iconSecondary).toBeDefined();
      expect(lightTheme.colors.iconDisabled).toBeDefined();
    });

    it('has action colors', () => {
      expect(lightTheme.colors.consumeAction).toBeDefined();
      expect(lightTheme.colors.wasteAction).toBeDefined();
      expect(lightTheme.colors.purchaseAction).toBeDefined();
    });

    it('has status colors', () => {
      expect(lightTheme.colors.status).toBeDefined();
      expect(lightTheme.colors.status.pending).toBeDefined();
      expect(lightTheme.colors.status.accepted).toBeDefined();
    });

    it('has role colors', () => {
      expect(lightTheme.colors.roles).toBeDefined();
      expect(lightTheme.colors.roles.owner).toBeDefined();
      expect(lightTheme.colors.roles.admin).toBeDefined();
    });

    it('has validation colors', () => {
      expect(lightTheme.colors.validation).toBeDefined();
      expect(lightTheme.colors.validation.errorBg).toBeDefined();
      expect(lightTheme.colors.validation.successBg).toBeDefined();
    });
  });

  describe('darkTheme', () => {
    it('exports a darkTheme object', () => {
      expect(darkTheme).toBeDefined();
    });

    it('has the same common theme structure as lightTheme', () => {
      // Both should have the same spacing, typography, etc.
      expect(darkTheme.spacing).toEqual(lightTheme.spacing);
      expect(darkTheme.typography).toEqual(lightTheme.typography);
      expect(darkTheme.fonts).toEqual(lightTheme.fonts);
      expect(darkTheme.radii).toEqual(lightTheme.radii);
      expect(darkTheme.shadows).toEqual(lightTheme.shadows);
      expect(darkTheme.sizes).toEqual(lightTheme.sizes);
      expect(darkTheme.zIndex).toEqual(lightTheme.zIndex);
      expect(darkTheme.opacity).toEqual(lightTheme.opacity);
    });

    it('has dark mode background color', () => {
      // Dark background should be dark (warm charcoal)
      expect(darkTheme.colors.background).toBe('#211E18');
    });

    it('has dark mode text colors', () => {
      // Text should be light in dark mode (warm white)
      expect(darkTheme.colors.textPrimary).toBe('#FAF9F7');
    });

    it('has colors that differ from light theme', () => {
      // Background should differ
      expect(darkTheme.colors.background).not.toBe(
        lightTheme.colors.background,
      );
      // Text primary should differ
      expect(darkTheme.colors.textPrimary).not.toBe(
        lightTheme.colors.textPrimary,
      );
    });

    it('has all the same color keys as lightTheme', () => {
      const lightKeys = Object.keys(lightTheme.colors).sort();
      const darkKeys = Object.keys(darkTheme.colors).sort();
      expect(darkKeys).toEqual(lightKeys);
    });

    it('has dark-mode specific expiration colors', () => {
      expect(darkTheme.colors.expiration).toBeDefined();
      expect(darkTheme.colors.expiration.expiredBg).toBeDefined();
    });

    it('has dark-mode specific filter tab colors', () => {
      expect(darkTheme.colors.filterTab).toBeDefined();
      expect(darkTheme.colors.filterTab.inactiveBg).toBeDefined();
    });

    it('has dark-mode alert banner colors', () => {
      expect(darkTheme.colors.alertBanner).toBeDefined();
      expect(darkTheme.colors.alertBanner.error).toBeDefined();
      expect(darkTheme.colors.alertBanner.warning).toBeDefined();
      expect(darkTheme.colors.alertBanner.info).toBeDefined();
      expect(darkTheme.colors.alertBanner.success).toBeDefined();
    });
  });

  describe('type exports', () => {
    it('Theme type is compatible with lightTheme', () => {
      const theme: Theme = lightTheme;
      expect(theme).toBeDefined();
    });
  });
});
