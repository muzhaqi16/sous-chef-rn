import React from 'react';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import type { CardLeftSlotProps } from './types';

/** The row's photo; nothing when it has none. */
export const CardLeftSlot: React.FC<CardLeftSlotProps> = ({ imageUrl }) => (
  <RowThumbnail uri={imageUrl} />
);
