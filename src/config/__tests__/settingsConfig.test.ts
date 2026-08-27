import {
  PERSONAL_INFO_CONFIG,
  PROFILE_SETTINGS_CONFIG,
} from '../settingsConfig';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';

describe('settingsConfig', () => {
  describe('PERSONAL_INFO_CONFIG', () => {
    it('is an array of sections', () => {
      expect(Array.isArray(PERSONAL_INFO_CONFIG)).toBe(true);
      expect(PERSONAL_INFO_CONFIG.length).toBeGreaterThan(0);
    });

    it('has a Personal Information section', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.id === 'personalInformation',
      );
      expect(section).toBeDefined();
      expect(section!.items.length).toBeGreaterThan(0);
    });

    it('has a Privacy Settings section', () => {
      const section = PERSONAL_INFO_CONFIG.find(s => s.id === 'privacy');
      expect(section).toBeDefined();
    });

    it('Personal Information section contains expected fields', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.id === 'personalInformation',
      )!;
      const keys = section.items.map(item => item.key);
      expect(keys).toContain('email');
      expect(keys).toContain('firstName');
      expect(keys).toContain('lastName');
      expect(keys).toContain('displayName');
    });

    it('email field is type info (read-only)', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.id === 'personalInformation',
      )!;
      const emailItem = section.items.find(i => i.key === 'email');
      expect(emailItem!.type).toBe('info');
    });

    it('gender field has options', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.id === 'personalInformation',
      )!;
      const genderItem = section.items.find(i => i.key === 'gender');
      expect(genderItem!.type).toBe('modal');
      if (genderItem && 'options' in genderItem) {
        expect(genderItem.options!.length).toBeGreaterThan(0);
      }
    });

    it('profileVisibility field has options', () => {
      const section = PERSONAL_INFO_CONFIG.find(s => s.id === 'privacy')!;
      const visibilityItem = section.items.find(
        i => i.key === 'profileVisibility',
      );
      expect(visibilityItem!.type).toBe('modal');
      if (visibilityItem && 'options' in visibilityItem) {
        expect(visibilityItem.options).toEqual([
          {
            labelKey: 'personalInformation.visibilityPublic',
            value: ProfileVisibility.Public,
          },
          {
            labelKey: 'personalInformation.visibilityFriendsOnly',
            value: ProfileVisibility.Friends,
          },
          {
            labelKey: 'personalInformation.visibilityPrivate',
            value: ProfileVisibility.Private,
          },
        ]);
      }
    });

    // The options are the wire values, not labels. FRIENDS_ONLY shipped here
    // for a schema that only has FRIENDS: the server refused every selection
    // and the optimistic write reverted with nothing shown to the user.
    it('offers only profileVisibility values the schema defines', () => {
      const section = PERSONAL_INFO_CONFIG.find(s => s.id === 'privacy')!;
      const visibilityItem = section.items.find(
        i => i.key === 'profileVisibility',
      )!;
      const allowed: string[] = Object.values(ProfileVisibility);

      expect(visibilityItem.options!.map(o => o.value).sort()).toEqual(
        [...allowed].sort(),
      );
    });
  });

  describe('PROFILE_SETTINGS_CONFIG', () => {
    it('is an array of sections', () => {
      expect(Array.isArray(PROFILE_SETTINGS_CONFIG)).toBe(true);
      expect(PROFILE_SETTINGS_CONFIG.length).toBeGreaterThan(0);
    });

    it('each section has a title and items array', () => {
      for (const section of PROFILE_SETTINGS_CONFIG) {
        expect(typeof section.titleKey).toBe('string');
        expect(Array.isArray(section.items)).toBe(true);
        expect(section.items.length).toBeGreaterThan(0);
      }
    });

    it('has a Security section with biometric and change password', () => {
      const security = PROFILE_SETTINGS_CONFIG.find(s => s.id === 'security');
      expect(security).toBeDefined();
      const keys = security!.items.map(i => i.key);
      expect(keys).toContain('biometricAuthentication');
      expect(keys).toContain('changePassword');
    });

    it('has an Appearance & Language section with appearance and language entries', () => {
      const section = PROFILE_SETTINGS_CONFIG.find(
        s => s.id === 'appearanceAndLanguage',
      );
      expect(section).toBeDefined();
      const appearanceItem = section!.items.find(i => i.key === 'appearance');
      expect(appearanceItem!.type).toBe('navigation');
    });

    it('has a logout action', () => {
      const logoutSection = PROFILE_SETTINGS_CONFIG.find(s =>
        s.items.some(i => i.key === 'logout'),
      );
      expect(logoutSection).toBeDefined();
      const logoutItem = logoutSection!.items.find(i => i.key === 'logout');
      expect(logoutItem!.type).toBe('action');
      expect(logoutItem!.labelKey).toBe('profile.labels.logout');
    });

    it('has Developer section with debugInfo and performanceDashboard', () => {
      const devSection = PROFILE_SETTINGS_CONFIG.find(
        s => s.id === 'developer',
      );
      expect(devSection).toBeDefined();
      const keys = devSection!.items.map(i => i.key);
      expect(keys).toContain('debugInfo');
      expect(keys).toContain('performanceDashboard');
    });
  });
});
