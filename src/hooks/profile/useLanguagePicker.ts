import {useState} from 'react';
import {useShallow} from 'zustand/shallow';
import {useAppStore, selectPreferences} from '#store/useAppStore';
import {LANGUAGE_OPTIONS} from '../../constants/languages';

export const useLanguagePicker = () => {
  const {language, setLanguage} = useAppStore(useShallow(selectPreferences));
  const [langPickerVisible, setLangPickerVisible] = useState(false);

  const showLanguagePicker = () => setLangPickerVisible(true);
  const hideLanguagePicker = () => setLangPickerVisible(false);

  const selectLanguage = (value: string) => {
    setLanguage(value);
    hideLanguagePicker();
  };

  return {
    langPickerVisible,
    languageOptions: LANGUAGE_OPTIONS,
    selectedLanguage: language || '',
    showLanguagePicker,
    hideLanguagePicker,
    selectLanguage,
  };
};
