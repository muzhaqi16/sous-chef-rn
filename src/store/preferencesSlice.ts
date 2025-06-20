import {StateCreator} from 'zustand';

export interface PreferencesState {
  theme: 'light' | 'dark';
  onBoardingCompleted?: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setOnBoardingCompleted?: (completed: boolean) => void;
}

export const createPreferencesSlice: StateCreator<PreferencesState> = set => ({
  theme: 'light',
  setTheme: theme => set({theme}),
  onBoardingCompleted: false,
  setOnBoardingCompleted: completed => set({onBoardingCompleted: completed}),
});
