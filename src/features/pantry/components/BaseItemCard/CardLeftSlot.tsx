import React from 'react';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import type { CardLeftSlotProps } from './types';

/** The row's thumbnail, or a placeholder tile, so rows stay aligned. */
export const CardLeftSlot: React.FC<CardLeftSlotProps> = ({ imageUrl }) => (
  <RowThumbnail uri={imageUrl} />
);
