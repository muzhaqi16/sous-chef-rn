import React from 'react';
import type { FC } from 'react';
import { CodeInput } from '../atoms/CodeInput'; // wherever your original lives

type AdapterProps = {
  label: string; // will be ignored
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void; // you can ignore or forward
  placeholder?: string; // ignored too
};

export const CodeInputAdapter: FC<AdapterProps> = ({ value, onChangeText }) => (
  <CodeInput
    value={value}
    onChange={onChangeText}
    // if CodeInput exposes an onBlur or similar, forward it; otherwise ignore
    // onBlur={onBlur}
  />
);
