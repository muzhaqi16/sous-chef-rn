import {JSX} from 'react';

export type SettingType = 'text' | 'switch' | 'modal' | 'radio';

export interface SettingItem {
  key: string;
  label: string;
  type: SettingType;
  icon?: JSX.Element;
  value?: string | boolean;
  onPress?: () => void;
  onSave?: (val: any) => void;
  options?: {label: string; value: string}[]; // for modal or radio
  selected?: string; // for radio
}
