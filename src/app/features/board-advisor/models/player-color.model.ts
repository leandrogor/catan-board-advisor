export interface PlayerColor {
  id: 'red' | 'blue' | 'mustard' | 'cream' | 'green' | 'chocolate';
  hex: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  { id: 'red', hex: '#ac262a' },
  { id: 'blue', hex: '#071439' },
  { id: 'mustard', hex: '#dd9100' },
  { id: 'cream', hex: '#ded3a7' },
  { id: 'green', hex: '#003034' },
  { id: 'chocolate', hex: '#281513' },
];
