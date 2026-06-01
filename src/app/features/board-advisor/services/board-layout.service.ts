import { Injectable } from '@angular/core';
import { HexDefinition, HexLetter } from '../models/hex.model';
import { EXT_CATAN_LETTER_VALUES } from '../data/ext-catan-letter-values.data';
import { EXT_CATAN_DEFAULT_LAYOUT, DesertPositions } from '../data/ext-catan-board-layout.data';
import { hexCenter } from '../../../shared/utils/hex-math.utils';

@Injectable({ providedIn: 'root' })
export class BoardLayoutService {
  buildHexGrid(desertPositions: DesertPositions, R: number): HexDefinition[] {
    const hexes: HexDefinition[] = [];

    for (let row = 0; row < EXT_CATAN_DEFAULT_LAYOUT.length; row++) {
      const rowLetters = EXT_CATAN_DEFAULT_LAYOUT[row];
      for (let col = 0; col < rowLetters.length; col++) {
        const letter = rowLetters[col];
        const isDesert = this.isDesertPosition(row, col, desertPositions);
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

  private isDesertPosition(row: number, col: number, desertPositions: DesertPositions): boolean {
    return (
      (row === desertPositions.L1.row && col === desertPositions.L1.col) ||
      (row === desertPositions.L2.row && col === desertPositions.L2.col)
    );
  }

  private getDiceNumber(letter: HexLetter): number | null {
    return EXT_CATAN_LETTER_VALUES[letter];
  }
}
