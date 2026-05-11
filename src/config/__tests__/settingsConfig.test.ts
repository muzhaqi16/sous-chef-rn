import {
  PERSONAL_INFO_CONFIG,
  PROFILE_SETTINGS_CONFIG,
} from '../settingsConfig';

describe('settingsConfig', () => {
  describe('PERSONAL_INFO_CONFIG', () => {
    it('is an array of sections', () => {
      expect(Array.isArray(PERSONAL_INFO_CONFIG)).toBe(true);
      expect(PERSONAL_INFO_CONFIG.length).toBeGreaterThan(0);
    });

    it('has a Personal Information section', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.title === 'Personal Information',
      );
      expect(section).toBeDefined();
      expect(section!.items.length).toBeGreaterThan(0);
    });

    it('has a Privacy Settings section', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.title === 'Privacy Settings',
      );
      expect(section).toBeDefined();
    });

    it('Personal Information section contains expected fields', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.title === 'Personal Information',
      )!;
      const keys = section.items.map(item => item.key);
      expect(keys).toContain('email');
      expect(keys).toContain('firstName');
      expect(keys).toContain('lastName');
      expect(keys).toContain('displayName');
    });

    it('email field is type info (read-only)', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.title === 'Personal Information',
      )!;
      const emailItem = section.items.find(i => i.key === 'email');
      expect(emailItem!.type).toBe('info');
    });

    it('gender field has options', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.title === 'Personal Information',
      )!;
      const genderItem = section.items.find(i => i.key === 'gender') as any;
      expect(genderItem!.type).toBe('modal');
      expect(genderItem!.options.length).toBeGreaterThan(0);
    });

    it('profileVisibility field has options', () => {
      const section = PERSONAL_INFO_CONFIG.find(
        s => s.title === 'Privacy Settings',
      )!;
      const visibilityItem = section.items.find(
        i => i.key === 'profileVisibility',
      ) as any;
      expect(visibilityItem!.type).toBe('modal');
      expect(visibilityItem!.options).toEqual([
        { label: 'Public', value: 'PUBLIC' },
        { label: 'Friends Only', value: 'FRIENDS_ONLY' },
        { label: 'Private', value: 'PRIVATE' },
      ]);
    });
  });

  describe('PROFILE_SETTINGS_CONFIG', () => {
    it('is an array of sections', () => {
      expect(Array.isArray(PROFILE_SETTINGS_CONFIG)).toBe(true);
      expect(PROFILE_SETTINGS_CONFIG.length).toBeGreaterThan(0);
    });

    it('each section has a title and items array', () => {
      for (const section of PROFILE_SETTINGS_CONFIG) {
        expect(typeof section.title).toBe('string');
        expect(Array.isArray(section.items)).toBe(true);
        expect(section.items.length).toBeGreaterThan(0);
      }
    });

    it('has a Security section with biometric and change password', () => {
      const security = PROFILE_SETTINGS_CONFIG.find(
        s => s.title === 'Security',
      );
      expect(security).toBeDefined();
      const keys = security!.items.map(i => i.key);
      expect(keys).toContain('biometricAuthentication');
      expect(keys).toContain('changePassword');
    });

    it('has an Appearance & Language section with appearance and language entries', () => {
      const section = PROFILE_SETTINGS_CONFIG.find(
        s => s.title === 'Appearance & Language',
      );
      expect(section).toBeDefined();
      const appearanceItem = section!.items.find(
        i => i.key === 'appearance',
      ) as any;
      expect(appearanceItem!.type).toBe('navigation');
    });

    it('has a logout action', () => {
      const logoutSection = PROFILE_SETTINGS_CONFIG.find(s =>
        s.items.some(i => i.key === 'logout'),
      );
      expect(logoutSection).toBeDefined();
      const logoutItem = logoutSection!.items.find(i => i.key === 'logout');
      expect(logoutItem!.type).toBe('action');
      expect(logoutItem!.label).toBe('Log Out');
    });

    it('has Developer section with debugInfo and performanceDashboard', () => {
      const devSection = PROFILE_SETTINGS_CONFIG.find(
        s => s.title === 'Developer',
      );
      expect(devSection).toBeDefined();
      const keys = devSection!.items.map(i => i.key);
      expect(keys).toContain('debugInfo');
      expect(keys).toContain('performanceDashboard');
    });
  });
});
