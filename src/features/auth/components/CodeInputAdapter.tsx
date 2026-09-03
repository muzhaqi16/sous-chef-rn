import React from 'react';
import type { FC } from 'react';
import { CodeInput } from '#components/atoms/CodeInput';

type AdapterProps = {
  label: string; // will be ignored
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  onComplete?: (code: string) => void;
  placeholder?: string; // ignored too
};

export const CodeInputAdapter: FC<AdapterProps> = ({
  value,
  onChangeText,
  onBlur,
  onComplete,
}) => (
  <CodeInput
    value={value}
    onChange={onChangeText}
    onBlur={onBlur}
    onComplete={onComplete}
  />
);
