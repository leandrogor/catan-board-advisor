import { Injectable } from '@angular/core';
import { HexDefinition, HexLetter } from '../models/hex.model';
import { EXT_CATAN_LETTER_VALUES } from '../data/ext-catan-letter-values.data';
import { BASE_CATAN_LETTER_VALUES } from '../data/base-catan-letter-values.data';
import {
  EXT_BOARD_ROW_SIZES,
  DesertState,
  BaseDesertState,
  ExtDesertState,
} from '../data/ext-catan-board-layout.data';
import { BASE_BOARD_ROW_SIZES } from '../data/base-catan-board-layout.data';
import {
  hexCenter,
  baseHexCenter,
  assignSpiralLetters,
  assignBaseSpiralLetters,
} from '../../../shared/utils/hex-math.utils';

@Injectable({ providedIn: 'root' })
export class BoardLayoutService {
  /**
   * Builds the hex grid for whichever variant is currently active.
   * Dispatches to buildExtHexGrid or buildBaseHexGrid based on desertState.variant.
   */
  buildHexGrid(desertState: DesertState, R: number): HexDefinition[] {
    if (desertState.variant === 'base') {
      return this.buildBaseHexGrid(desertState, R);
    }
    return this.buildExtHexGrid(desertState, R);
  }

  // ── Extension (5-6 players) ───────────────────────────────────────────────

  private buildExtHexGrid(desertState: ExtDesertState, R: number): HexDefinition[] {
    const hexes: HexDefinition[] = [];
    const letterAssignment = assignSpiralLetters(desertState);

    const desertKey1 = `${desertState.L1.row}-${desertState.L1.col}`;
    const desertKey2 = `${desertState.L2.row}-${desertState.L2.col}`;

    for (let row = 0; row < EXT_BOARD_ROW_SIZES.length; row++) {
      for (let col = 0; col < EXT_BOARD_ROW_SIZES[row]; col++) {
        const posKey = `${row}-${col}`;
        const isDesert = posKey === desertKey1 || posKey === desertKey2;

        let letter: HexLetter;
        if (posKey === desertKey1) {
          letter = 'L1';
        } else if (posKey === desertKey2) {
          letter = 'L2';
        } else {
          letter = (letterAssignment.get(posKey) ?? 'A') as HexLetter;
        }

        const diceNumber = isDesert ? null : (EXT_CATAN_LETTER_VALUES[letter] ?? null);
        const center = hexCenter(row, col, R);

        hexes.push({ id: `hex-${row}-${col}`, row, col, letter, diceNumber, isDesert, center });
      }
    }

    return hexes;
  }

  // ── Base game (3-4 players) ───────────────────────────────────────────────

  private buildBaseHexGrid(desertState: BaseDesertState, R: number): HexDefinition[] {
    const hexes: HexDefinition[] = [];
    const letterAssignment = assignBaseSpiralLetters(desertState.L1);

    const desertKey = `${desertState.L1.row}-${desertState.L1.col}`;

    for (let row = 0; row < BASE_BOARD_ROW_SIZES.length; row++) {
      for (let col = 0; col < BASE_BOARD_ROW_SIZES[row]; col++) {
        const posKey = `${row}-${col}`;
        const isDesert = posKey === desertKey;

        const letter: HexLetter = isDesert
          ? 'L1'
          : ((letterAssignment.get(posKey) ?? 'A') as HexLetter);

        const diceNumber = isDesert ? null : (BASE_CATAN_LETTER_VALUES[letter] ?? null);
        const center = baseHexCenter(row, col, R);

        hexes.push({ id: `hex-${row}-${col}`, row, col, letter, diceNumber, isDesert, center });
      }
    }

    return hexes;
  }
}
