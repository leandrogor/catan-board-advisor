export type HexLetter =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Za'
  | 'Zb'
  | 'Zc'
  | 'L1'
  | 'L2';

export interface HexDefinition {
  id: string; // `hex-${row}-${col}`
  row: number;
  col: number;
  letter: HexLetter;
  diceNumber: number | null; // null for deserts
  isDesert: boolean;
  center: { x: number; y: number }; // SVG pixel coordinates
}
