import { HexLetter } from '../models/hex.model';

/**
 * Dice-number values for each letter token in the base Catan game (3-4 players).
 * Only letters A–R and L1 (desert) are used; L1 is null (desert, no number).
 */
export const BASE_CATAN_LETTER_VALUES: Partial<Record<HexLetter, number | null>> = {
  A: 5,
  B: 2,
  C: 6,
  D: 3,
  E: 8,
  F: 10,
  G: 9,
  H: 12,
  I: 11,
  J: 4,
  K: 8,
  L: 10,
  M: 9,
  N: 4,
  O: 5,
  P: 6,
  Q: 3,
  R: 11,
  L1: null,
};
