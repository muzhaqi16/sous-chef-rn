import {
  createPersonalItems,
  createThemeItems,
  createNotificationItems,
  createLogoutItem,
} from '../settingsFactory';

describe('settingsFactory', () => {
  describe('createPersonalItems', () => {
    it('creates 4 personal items', () => {
      const items = createPersonalItems({}, jest.fn());
      expect(items).toHaveLength(4);
    });

    it('creates items with correct keys', () => {
      const items = createPersonalItems({}, jest.fn());
      const keys = items.map((i: any) => i.key);
      expect(keys).toEqual(['firstName', 'lastName', 'phone', 'dateOfBirth']);
    });

    it('populates values from profile', () => {
      const profile = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-1234',
        dateOfBirth: '1990-01-01',
      };
      const items = createPersonalItems(profile, jest.fn());
      expect(items[0].value).toBe('John');
      expect(items[1].value).toBe('Doe');
      expect(items[2].value).toBe('555-1234');
      expect(items[3].value).toBe('1990-01-01');
    });

    it('defaults to empty string for missing profile fields', () => {
      const items = createPersonalItems(null, jest.fn());
      items.forEach((item: any) => {
        expect(item.value).toBe('');
      });
    });

    it('calls updateProfile on save', () => {
      const updateProfile = jest.fn();
      const items = createPersonalItems({}, updateProfile);
      items[0].onSave('Jane');
      expect(updateProfile).toHaveBeenCalledWith({ firstName: 'Jane' });
    });

    it('calls updateProfile with correct field for each item', () => {
      const updateProfile = jest.fn();
      const items = createPersonalItems({}, updateProfile);
      items[1].onSave('Smith');
      expect(updateProfile).toHaveBeenCalledWith({ lastName: 'Smith' });
      items[2].onSave('555-9999');
      expect(updateProfile).toHaveBeenCalledWith({ phone: '555-9999' });
    });
  });

  describe('createThemeItems', () => {
    it('creates 2 theme items', () => {
      const store = { theme: 'LIGHT', language: 'en', setTheme: jest.fn(), setLanguage: jest.fn() };
      const items = createThemeItems(store, jest.fn());
      expect(items).toHaveLength(2);
    });

    it('sets darkMode value based on store theme', () => {
      const store = { theme: 'DARK', language: 'en', setTheme: jest.fn(), setLanguage: jest.fn() };
      const items = createThemeItems(store, jest.fn());
      expect(items[0].value).toBe(true);
    });

    it('toggles theme on press', () => {
      const store = { theme: 'LIGHT', language: 'en', setTheme: jest.fn(), setLanguage: jest.fn() };
      const updatePreferences = jest.fn();
      const items = createThemeItems(store, updatePreferences);
      items[0].onPress();
      expect(store.setTheme).toHaveBeenCalledWith('DARK');
      expect(updatePreferences).toHaveBeenCalledWith({ theme: 'DARK' });
    });

    it('toggles theme from DARK to LIGHT', () => {
      const store = { theme: 'DARK', language: 'en', setTheme: jest.fn(), setLanguage: jest.fn() };
      const updatePreferences = jest.fn();
      const items = createThemeItems(store, updatePreferences);
      items[0].onPress();
      expect(store.setTheme).toHaveBeenCalledWith('LIGHT');
    });

    it('saves language on change', () => {
      const store = { theme: 'LIGHT', language: 'en', setTheme: jest.fn(), setLanguage: jest.fn() };
      const updatePreferences = jest.fn();
      const items = createThemeItems(store, updatePreferences);
      items[1].onSave('fr');
      expect(store.setLanguage).toHaveBeenCalledWith('fr');
      expect(updatePreferences).toHaveBeenCalledWith({ language: 'fr' });
    });
  });

  describe('createNotificationItems', () => {
    it('creates 2 notification items', () => {
      const store = {
        emailNotifications: true,
        pushNotifications: true,
        setEmailNotifications: jest.fn(),
        setPushNotifications: jest.fn(),
      };
      const items = createNotificationItems(store, jest.fn());
      expect(items).toHaveLength(2);
    });

    it('toggles email notifications', () => {
      const store = {
        emailNotifications: true,
        pushNotifications: true,
        setEmailNotifications: jest.fn(),
        setPushNotifications: jest.fn(),
      };
      const updatePreferences = jest.fn();
      const items = createNotificationItems(store, updatePreferences);
      items[0].onPress();
      expect(store.setEmailNotifications).toHaveBeenCalledWith(false);
      expect(updatePreferences).toHaveBeenCalledWith({ emailNotifications: false });
    });

    it('toggles push notifications', () => {
      const store = {
        emailNotifications: true,
        pushNotifications: false,
        setEmailNotifications: jest.fn(),
        setPushNotifications: jest.fn(),
      };
      const updatePreferences = jest.fn();
      const items = createNotificationItems(store, updatePreferences);
      items[1].onPress();
      expect(store.setPushNotifications).toHaveBeenCalledWith(true);
      expect(updatePreferences).toHaveBeenCalledWith({ pushNotifications: true });
    });
  });

  describe('createLogoutItem', () => {
    it('creates a logout item', () => {
      const logout = jest.fn();
      const item = createLogoutItem(logout);
      expect(item.key).toBe('logout');
      expect(item.label).toBe('Log Out');
    });

    it('calls logout on press', () => {
      const logout = jest.fn();
      const item = createLogoutItem(logout);
      item.onPress();
      expect(logout).toHaveBeenCalled();
    });
  });
});
