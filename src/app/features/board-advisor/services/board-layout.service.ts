import { Injectable } from '@angular/core';
import { HexDefinition, HexLetter } from '../models/hex.model';
import { EXT_CATAN_LETTER_VALUES } from '../data/ext-catan-letter-values.data';
import { EXT_BOARD_ROW_SIZES, DesertPositions } from '../data/ext-catan-board-layout.data';
import { hexCenter, assignSpiralLetters } from '../../../shared/utils/hex-math.utils';

@Injectable({ providedIn: 'root' })
export class BoardLayoutService {
  /**
   * Builds the hex grid with dynamically assigned spiral letters.
   * Letters A→Zc are re-assigned in spiral order each time desert positions change,
   * skipping whichever two positions are currently set as deserts.
   */
  buildHexGrid(desertPositions: DesertPositions, R: number): HexDefinition[] {
    const hexes: HexDefinition[] = [];
    const letterAssignment = assignSpiralLetters(desertPositions);

    const desertKey1 = `${desertPositions.L1.row}-${desertPositions.L1.col}`;
    const desertKey2 = `${desertPositions.L2.row}-${desertPositions.L2.col}`;

    for (let row = 0; row < EXT_BOARD_ROW_SIZES.length; row++) {
      for (let col = 0; col < EXT_BOARD_ROW_SIZES[row]; col++) {
        const posKey = `${row}-${col}`;
        const isDesert = posKey === desertKey1 || posKey === desertKey2;

        // Determine which desert label (L1 or L2) this desert position corresponds to
        let letter: HexLetter;
        if (posKey === desertKey1) {
          letter = 'L1';
        } else if (posKey === desertKey2) {
          letter = 'L2';
        } else {
          // Use dynamically assigned spiral letter
          letter = (letterAssignment.get(posKey) ?? 'A') as HexLetter;
        }

        const diceNumber = isDesert ? null : this.getDiceNumber(letter);
        const center = hexCenter(row, col, R);

        hexes.push({
          id: `hex-${row}-${col}`,
          row,
          col,
          letter,
          diceNumber,
          isDesert,
          center,
        });
      }
    }

    return hexes;
  }

  private getDiceNumber(letter: HexLetter): number | null {
    return EXT_CATAN_LETTER_VALUES[letter] ?? null;
  }
}
