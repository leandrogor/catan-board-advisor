import { HexLetter } from '../models/hex.model';

export const BASE_BOARD_ROW_SIZES = [3, 4, 5, 4, 3] as const;

/**
 * Default base game layout — counterclockwise spiral from top-right corner:
 *
 *    C  B  A
 *   D  N  M  L
 *  E  O  L1  R  K
 *   F  P  Q  J
 *    G  H  I
 */
export const BASE_CATAN_DEFAULT_LAYOUT: HexLetter[][] = [
  ['C', 'B', 'A'], // Row 0
  ['D', 'N', 'M', 'L'], // Row 1
  ['E', 'O', 'L1', 'R', 'K'], // Row 2 (widest — desert defaults to center col 2)
  ['F', 'P', 'Q', 'J'], // Row 3
  ['G', 'H', 'I'], // Row 4
];

/** Default desert position for the base game: center of the board. */
export const BASE_DEFAULT_DESERT_POSITION = { row: 2, col: 2 } as const;
