import { Component, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';

/** Ways to roll each dice value, for theoretical probability display. */
const DICE_WAYS: Readonly<Record<number, number>> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

@Component({
  selector: 'app-hex-info-panel',
  imports: [DecimalPipe],
  templateUrl: './hex-info-panel.component.html',
})
export class HexInfoPanelComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly selectedHex = computed(() => {
    const id = this.store.selectedHexId();
    if (!id) return null;
    return this.store.hexes().find(h => h.id === id) ?? null;
  });

  /** Spiral letter for this hex (Phase 1/2). */
  protected readonly displayLetter = computed(() => {
    const hex = this.selectedHex();
    if (!hex) return '';
    const posKey = `${hex.row}-${hex.col}`;
    return this.store.spiralLetterAssignment().get(posKey) ?? hex.letter;
  });

  protected readonly theoreticalProbability = computed(() => {
    const dice = this.selectedHex()?.diceNumber;
    if (dice == null) return '—';
    const ways = DICE_WAYS[dice] ?? 0;
    const pct = ((ways / 36) * 100).toFixed(1);
    return `${ways}/36 ≈ ${pct}%`;
  });

  protected isHotNumber(n: number | null): boolean {
    return n === 6 || n === 8;
  }
}
