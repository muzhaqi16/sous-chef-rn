import React from 'react';
import { SvgXml } from 'react-native-svg';

const REFRIGERATOR = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="12" y="6" width="40" height="52" rx="5" fill="#5B8DB8" fill-opacity="0.15"/>
  <rect x="12" y="6" width="40" height="52" rx="5" stroke="#5B8DB8" stroke-width="2.5"/>
  <line x1="12" y1="28" x2="52" y2="28" stroke="#5B8DB8" stroke-width="2.5"/>
  <rect x="22" y="13" width="4" height="10" rx="2" fill="#5B8DB8" fill-opacity="0.6"/>
  <rect x="22" y="33" width="4" height="10" rx="2" fill="#5B8DB8" fill-opacity="0.6"/>
  <circle cx="48" cy="17" r="1.5" fill="#5B8DB8" fill-opacity="0.4"/>
  <circle cx="48" cy="38" r="1.5" fill="#5B8DB8" fill-opacity="0.4"/>
  <line x1="38" y1="14" x2="38" y2="24" stroke="#5B8DB8" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="34" y1="19" x2="42" y2="19" stroke="#5B8DB8" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="35.5" y1="15.5" x2="40.5" y2="22.5" stroke="#5B8DB8" stroke-width="1.2" stroke-opacity="0.35"/>
  <line x1="40.5" y1="15.5" x2="35.5" y2="22.5" stroke="#5B8DB8" stroke-width="1.2" stroke-opacity="0.35"/>
</svg>`;

const FREEZER = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="22" width="48" height="34" rx="5" fill="#4AACCC" fill-opacity="0.15"/>
  <rect x="8" y="22" width="48" height="34" rx="5" stroke="#4AACCC" stroke-width="2.5"/>
  <rect x="8" y="14" width="48" height="12" rx="5" fill="#4AACCC" fill-opacity="0.25"/>
  <rect x="8" y="14" width="48" height="12" rx="5" stroke="#4AACCC" stroke-width="2.5"/>
  <rect x="24" y="11" width="16" height="5" rx="2.5" fill="#4AACCC" fill-opacity="0.6"/>
  <line x1="32" y1="30" x2="32" y2="48" stroke="#4AACCC" stroke-width="2" stroke-opacity="0.5"/>
  <line x1="23" y1="39" x2="41" y2="39" stroke="#4AACCC" stroke-width="2" stroke-opacity="0.5"/>
  <line x1="25.4" y1="32.4" x2="38.6" y2="45.6" stroke="#4AACCC" stroke-width="1.5" stroke-opacity="0.35"/>
  <line x1="38.6" y1="32.4" x2="25.4" y2="45.6" stroke="#4AACCC" stroke-width="1.5" stroke-opacity="0.35"/>
  <circle cx="32" cy="30" r="1.8" fill="#4AACCC" fill-opacity="0.5"/>
  <circle cx="32" cy="48" r="1.8" fill="#4AACCC" fill-opacity="0.5"/>
  <circle cx="23" cy="39" r="1.8" fill="#4AACCC" fill-opacity="0.5"/>
  <circle cx="41" cy="39" r="1.8" fill="#4AACCC" fill-opacity="0.5"/>
</svg>`;

const PANTRY_SHELF = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="48" height="50" rx="3" fill="#C47F3A" fill-opacity="0.08"/>
  <rect x="8" y="8" width="48" height="50" rx="3" stroke="#C47F3A" stroke-width="2"/>
  <rect x="8" y="22" width="48" height="3.5" rx="1.5" fill="#C47F3A" fill-opacity="0.35"/>
  <rect x="8" y="37" width="48" height="3.5" rx="1.5" fill="#C47F3A" fill-opacity="0.35"/>
  <rect x="14" y="13" width="7" height="9" rx="2" fill="#C47F3A" fill-opacity="0.5"/>
  <circle cx="32" cy="17.5" r="4.5" fill="#C47F3A" fill-opacity="0.5"/>
  <rect x="40" y="14" width="9" height="8" rx="1.5" fill="#C47F3A" fill-opacity="0.4"/>
  <rect x="13" y="27.5" width="6" height="9.5" rx="1.5" fill="#C47F3A" fill-opacity="0.45"/>
  <rect x="23" y="29" width="8" height="8" rx="2" fill="#C47F3A" fill-opacity="0.4"/>
  <rect x="35" y="27.5" width="5" height="9.5" rx="1.5" fill="#C47F3A" fill-opacity="0.5"/>
  <rect x="43" y="28" width="7" height="9" rx="1.5" fill="#C47F3A" fill-opacity="0.35"/>
  <rect x="12" y="43.5" width="9" height="12.5" rx="2" fill="#C47F3A" fill-opacity="0.4"/>
  <rect x="26" y="44.5" width="7" height="11.5" rx="2" fill="#C47F3A" fill-opacity="0.5"/>
  <rect x="38" y="43.5" width="8" height="12.5" rx="1.5" fill="#C47F3A" fill-opacity="0.4"/>
</svg>`;

const CABINET = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="48" height="50" rx="4" fill="#A0724A" fill-opacity="0.12"/>
  <rect x="8" y="8" width="48" height="50" rx="4" stroke="#A0724A" stroke-width="2.5"/>
  <line x1="32" y1="8" x2="32" y2="58" stroke="#A0724A" stroke-width="2" stroke-opacity="0.5"/>
  <line x1="8" y1="34" x2="56" y2="34" stroke="#A0724A" stroke-width="2" stroke-opacity="0.5"/>
  <circle cx="27" cy="21" r="3" fill="#A0724A" fill-opacity="0.6"/>
  <circle cx="37" cy="21" r="3" fill="#A0724A" fill-opacity="0.6"/>
  <circle cx="27" cy="46" r="3" fill="#A0724A" fill-opacity="0.6"/>
  <circle cx="37" cy="46" r="3" fill="#A0724A" fill-opacity="0.6"/>
  <rect x="11" y="11" width="18" height="20" rx="2" stroke="#A0724A" stroke-width="1" stroke-opacity="0.25"/>
  <rect x="35" y="11" width="18" height="20" rx="2" stroke="#A0724A" stroke-width="1" stroke-opacity="0.25"/>
  <rect x="11" y="36.5" width="18" height="18.5" rx="2" stroke="#A0724A" stroke-width="1" stroke-opacity="0.25"/>
  <rect x="35" y="36.5" width="18" height="18.5" rx="2" stroke="#A0724A" stroke-width="1" stroke-opacity="0.25"/>
</svg>`;

const DRAWER = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="10" width="48" height="46" rx="4" fill="#8B6BAE" fill-opacity="0.1"/>
  <rect x="8" y="10" width="48" height="46" rx="4" stroke="#8B6BAE" stroke-width="2.5"/>
  <rect x="10" y="12" width="44" height="12" rx="3" fill="#8B6BAE" fill-opacity="0.18"/>
  <rect x="10" y="12" width="44" height="12" rx="3" stroke="#8B6BAE" stroke-width="1.5"/>
  <rect x="26" y="17" width="12" height="4" rx="2" fill="#8B6BAE" fill-opacity="0.6"/>
  <rect x="10" y="26" width="44" height="12" rx="3" fill="#8B6BAE" fill-opacity="0.18"/>
  <rect x="10" y="26" width="44" height="12" rx="3" stroke="#8B6BAE" stroke-width="1.5"/>
  <rect x="26" y="31" width="12" height="4" rx="2" fill="#8B6BAE" fill-opacity="0.6"/>
  <rect x="10" y="40" width="44" height="13" rx="3" fill="#8B6BAE" fill-opacity="0.18"/>
  <rect x="10" y="40" width="44" height="13" rx="3" stroke="#8B6BAE" stroke-width="1.5"/>
  <rect x="26" y="45.5" width="12" height="4" rx="2" fill="#8B6BAE" fill-opacity="0.6"/>
</svg>`;

const COUNTER = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="28" width="52" height="8" rx="3" fill="#6BAA7A" fill-opacity="0.5"/>
  <rect x="6" y="28" width="52" height="8" rx="3" stroke="#6BAA7A" stroke-width="2"/>
  <rect x="8" y="36" width="48" height="20" rx="3" fill="#6BAA7A" fill-opacity="0.1"/>
  <rect x="8" y="36" width="48" height="20" rx="3" stroke="#6BAA7A" stroke-width="1.5"/>
  <line x1="32" y1="36" x2="32" y2="56" stroke="#6BAA7A" stroke-width="1.5" stroke-opacity="0.4"/>
  <circle cx="27" cy="46" r="2.5" fill="#6BAA7A" fill-opacity="0.5"/>
  <circle cx="37" cy="46" r="2.5" fill="#6BAA7A" fill-opacity="0.5"/>
  <rect x="12" y="18" width="9" height="10" rx="3" fill="#6BAA7A" fill-opacity="0.45"/>
  <rect x="13" y="16" width="7" height="3" rx="1.5" fill="#6BAA7A" fill-opacity="0.35"/>
  <rect x="26" y="16" width="8" height="12" rx="2.5" fill="#6BAA7A" fill-opacity="0.5"/>
  <rect x="26" y="14" width="8" height="3" rx="1.5" fill="#6BAA7A" fill-opacity="0.35"/>
  <path d="M39 26 Q43.5 19 48 26" stroke="#6BAA7A" stroke-width="2" fill="none" stroke-opacity="0.5"/>
  <line x1="38" y1="26" x2="49" y2="26" stroke="#6BAA7A" stroke-width="2" stroke-opacity="0.4"/>
</svg>`;

const BASEMENT = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polyline points="8,56 8,38 18,38 18,46 28,46 28,36 38,36 38,27 54,27" stroke="#7A7A8C" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
  <line x1="6" y1="56" x2="58" y2="56" stroke="#7A7A8C" stroke-width="2.5" stroke-opacity="0.4"/>
  <rect x="40" y="36" width="16" height="20" rx="2" fill="#7A7A8C" fill-opacity="0.08"/>
  <rect x="40" y="36" width="16" height="20" rx="2" stroke="#7A7A8C" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="40" y1="43" x2="56" y2="43" stroke="#7A7A8C" stroke-width="1.2" stroke-opacity="0.4"/>
  <line x1="40" y1="50" x2="56" y2="50" stroke="#7A7A8C" stroke-width="1.2" stroke-opacity="0.4"/>
  <rect x="42" y="37.5" width="5" height="5" rx="1" fill="#7A7A8C" fill-opacity="0.45"/>
  <rect x="48" y="38" width="6" height="4.5" rx="1" fill="#7A7A8C" fill-opacity="0.35"/>
  <rect x="42" y="44" width="6" height="5.5" rx="1" fill="#7A7A8C" fill-opacity="0.4"/>
  <circle cx="20" cy="14" r="5" fill="#7A7A8C" fill-opacity="0.3"/>
  <line x1="20" y1="8" x2="20" y2="6" stroke="#7A7A8C" stroke-width="2" stroke-opacity="0.5"/>
  <path d="M16 18 Q20 22 24 18" stroke="#7A7A8C" stroke-width="1.5" fill="none" stroke-opacity="0.4"/>
</svg>`;

const GARAGE_OUTDOOR = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 30 L32 10 L56 30" stroke="#D47B4A" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
  <rect x="8" y="30" width="48" height="26" rx="2" fill="#D47B4A" fill-opacity="0.1"/>
  <rect x="8" y="30" width="48" height="26" rx="2" stroke="#D47B4A" stroke-width="2"/>
  <line x1="8" y1="37" x2="56" y2="37" stroke="#D47B4A" stroke-width="1.5" stroke-opacity="0.35"/>
  <line x1="8" y1="44" x2="56" y2="44" stroke="#D47B4A" stroke-width="1.5" stroke-opacity="0.35"/>
  <line x1="32" y1="30" x2="32" y2="56" stroke="#D47B4A" stroke-width="1.5" stroke-opacity="0.2"/>
  <rect x="28" y="52" width="8" height="3" rx="1.5" fill="#D47B4A" fill-opacity="0.5"/>
  <line x1="8" y1="30" x2="56" y2="30" stroke="#D47B4A" stroke-width="2.5" stroke-opacity="0.5"/>
  <rect x="25" y="15" width="14" height="10" rx="2" fill="#D47B4A" fill-opacity="0.2"/>
  <rect x="25" y="15" width="14" height="10" rx="2" stroke="#D47B4A" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="32" y1="15" x2="32" y2="25" stroke="#D47B4A" stroke-width="1" stroke-opacity="0.4"/>
  <line x1="25" y1="20" x2="39" y2="20" stroke="#D47B4A" stroke-width="1" stroke-opacity="0.4"/>
</svg>`;

const CLOSED_STORAGE = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="24" width="44" height="32" rx="4" fill="#B85C7A" fill-opacity="0.13"/>
  <rect x="10" y="24" width="44" height="32" rx="4" stroke="#B85C7A" stroke-width="2.5"/>
  <rect x="8" y="16" width="48" height="10" rx="4" fill="#B85C7A" fill-opacity="0.25"/>
  <rect x="8" y="16" width="48" height="10" rx="4" stroke="#B85C7A" stroke-width="2.5"/>
  <rect x="24" y="11" width="16" height="6" rx="3" fill="#B85C7A" fill-opacity="0.5"/>
  <rect x="26" y="38" width="12" height="9" rx="2.5" fill="#B85C7A" fill-opacity="0.4"/>
  <path d="M28 38 Q28 32 32 32 Q36 32 36 38" stroke="#B85C7A" stroke-width="2" fill="none"/>
  <circle cx="32" cy="43" r="2" fill="#B85C7A" fill-opacity="0.65"/>
  <line x1="10" y1="34" x2="54" y2="34" stroke="#B85C7A" stroke-width="1.2" stroke-opacity="0.25"/>
  <line x1="10" y1="44" x2="54" y2="44" stroke="#B85C7A" stroke-width="1.2" stroke-opacity="0.25"/>
</svg>`;

const BOAT_RV_STORAGE = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="22" width="46" height="26" rx="4" fill="#3A8FBF" fill-opacity="0.15"/>
  <rect x="6" y="22" width="46" height="26" rx="4" stroke="#3A8FBF" stroke-width="2.5"/>
  <rect x="52" y="32" width="6" height="14" rx="2" fill="#3A8FBF" fill-opacity="0.1"/>
  <path d="M52 32 L58 36 L58 46 L52 46" stroke="#3A8FBF" stroke-width="2" fill="none"/>
  <rect x="53" y="34" width="4" height="7" rx="1.5" fill="#3A8FBF" fill-opacity="0.3"/>
  <rect x="10" y="26" width="8" height="6" rx="1.5" fill="#3A8FBF" fill-opacity="0.35"/>
  <rect x="22" y="26" width="8" height="6" rx="1.5" fill="#3A8FBF" fill-opacity="0.35"/>
  <rect x="34" y="26" width="8" height="6" rx="1.5" fill="#3A8FBF" fill-opacity="0.35"/>
  <rect x="14" y="35" width="10" height="13" rx="2" stroke="#3A8FBF" stroke-width="1.5" fill="none" stroke-opacity="0.5"/>
  <circle cx="23" cy="41" r="1.5" fill="#3A8FBF" fill-opacity="0.5"/>
  <circle cx="18" cy="50" r="5" fill="#3A8FBF" fill-opacity="0.2"/>
  <circle cx="18" cy="50" r="5" stroke="#3A8FBF" stroke-width="2"/>
  <circle cx="18" cy="50" r="2" fill="#3A8FBF" fill-opacity="0.4"/>
  <circle cx="44" cy="50" r="5" fill="#3A8FBF" fill-opacity="0.2"/>
  <circle cx="44" cy="50" r="5" stroke="#3A8FBF" stroke-width="2"/>
  <circle cx="44" cy="50" r="2" fill="#3A8FBF" fill-opacity="0.4"/>
  <line x1="6" y1="36" x2="52" y2="36" stroke="#3A8FBF" stroke-width="1.5" stroke-opacity="0.25"/>
</svg>`;

const CUSTOM = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="44" height="44" rx="6" stroke="#E8A020" stroke-width="2.5" stroke-dasharray="5 3" fill="#E8A020" fill-opacity="0.06"/>
  <line x1="32" y1="22" x2="32" y2="42" stroke="#E8A020" stroke-width="3" stroke-linecap="round"/>
  <line x1="22" y1="32" x2="42" y2="32" stroke="#E8A020" stroke-width="3" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="2.5" fill="#E8A020" fill-opacity="0.3"/>
  <circle cx="48" cy="16" r="2.5" fill="#E8A020" fill-opacity="0.3"/>
  <circle cx="16" cy="48" r="2.5" fill="#E8A020" fill-opacity="0.3"/>
  <circle cx="48" cy="48" r="2.5" fill="#E8A020" fill-opacity="0.3"/>
</svg>`;

const SVG_MAP: Record<string, string> = {
  REFRIGERATOR,
  FREEZER,
  PANTRY_SHELF,
  CABINET,
  DRAWER,
  COUNTER,
  BASEMENT,
  GARAGE: GARAGE_OUTDOOR,
  OUTDOOR: GARAGE_OUTDOOR,
  CLOSET: CLOSED_STORAGE,
  BOAT_STORAGE: BOAT_RV_STORAGE,
  RV_STORAGE: BOAT_RV_STORAGE,
  CUSTOM,
};

interface StorageLocationIconProps {
  type: string;
  size?: number;
}

export const StorageLocationIcon: React.FC<StorageLocationIconProps> = ({
  type,
  size = 24,
}) => {
  const xml = SVG_MAP[type] ?? CUSTOM;
  return <SvgXml xml={xml} width={size} height={size} />;
};
