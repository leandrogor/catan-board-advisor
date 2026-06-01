import { HexLetter } from '../models/hex.model';

export const EXT_BOARD_ROW_SIZES = [3, 4, 5, 6, 5, 4, 3] as const;

export const EXT_CATAN_DEFAULT_LAYOUT: HexLetter[][] = [
  ['C', 'B', 'A'], // Row 0 - 3 hexes
  ['D', 'R', 'Q', 'P'], // Row 1 - 4 hexes
  ['E', 'S', 'Zb', 'Za', 'O'], // Row 2 - 5 hexes
  ['F', 'T', 'Zc', 'L1', 'Y', 'N'], // Row 3 - 6 hexes (widest)
  ['G', 'U', 'L2', 'X', 'M'], // Row 4 - 5 hexes
  ['H', 'V', 'W', 'L'], // Row 5 - 4 hexes
  ['I', 'J', 'K'], // Row 6 - 3 hexes
];

export interface DesertPositions {
  L1: { row: number; col: number };
  L2: { row: number; col: number };
}

export const DEFAULT_DESERT_POSITIONS: DesertPositions = {
  L1: { row: 3, col: 3 },
  L2: { row: 4, col: 2 },
};
