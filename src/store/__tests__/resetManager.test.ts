import { RESET_SCENARIOS } from '../resetManager';

describe('RESET_SCENARIOS', () => {
  it('LOGOUT clears auth and UI, preserves preferences, clears Apollo cache', () => {
    expect(RESET_SCENARIOS.LOGOUT).toEqual({
      auth: true,
      ui: true,
      preferences: false,
      clearApolloCache: true,
    });
  });

  it('SESSION_EXPIRED clears auth only, preserves cache for offline', () => {
    expect(RESET_SCENARIOS.SESSION_EXPIRED).toEqual({
      auth: true,
      ui: false,
      preferences: false,
      clearApolloCache: false,
    });
  });

  it('FULL_RESET clears everything', () => {
    expect(RESET_SCENARIOS.FULL_RESET).toEqual({
      auth: true,
      ui: true,
      preferences: true,
      clearApolloCache: true,
    });
  });

  it('ONBOARDING_RESET preserves auth, clears UI and preferences', () => {
    expect(RESET_SCENARIOS.ONBOARDING_RESET).toEqual({
      auth: false,
      ui: true,
      preferences: true,
      clearApolloCache: false,
    });
  });
});
