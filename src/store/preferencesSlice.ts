import {StateCreator} from 'zustand';

export interface PreferencesState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const createPreferencesSlice: StateCreator<PreferencesState> = set => ({
  theme: 'light',
  setTheme: theme => set({theme}),
});
