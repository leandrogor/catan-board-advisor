export interface PlayerColor {
  id: 'red' | 'blue' | 'mustard' | 'cream' | 'green' | 'chocolate';
  hex: string;
  darkHex?: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  { id: 'red', hex: '#ac262a', darkHex: '#ef4444' },
  { id: 'blue', hex: '#071439', darkHex: '#3b82f6' },
  { id: 'mustard', hex: '#dd9100', darkHex: '#fbbf24' },
  { id: 'cream', hex: '#ded3a7', darkHex: '#fef08a' },
  { id: 'green', hex: '#003034', darkHex: '#10b981' },
  { id: 'chocolate', hex: '#281513', darkHex: '#f97316' },
];

export function getPlayerDisplayColor(colorId: string, isDark: boolean): string {
  const color = PLAYER_COLORS.find(c => c.id === colorId);
  if (!color) return '#94a3b8';
  if (isDark && color.darkHex) {
    return color.darkHex;
  }
  return color.hex;
}
