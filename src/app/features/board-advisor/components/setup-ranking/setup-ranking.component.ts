import { Component, inject, computed, signal, HostListener, effect } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PlayerColor } from '../../models/player-color.model';

interface PlayerRankingRow {
  playerColor: PlayerColor;
  turnOrder: number; // 1-based index in playerColors
  totalScore: number;
  productionRank: number; // 1224 rule
}

@Component({
  selector: 'app-setup-ranking',
  templateUrl: './setup-ranking.component.html',
  styleUrl: './setup-ranking.component.scss',
})
export class SetupRankingComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);
  protected readonly openSwapPickerSlot = signal<number | null>(null);
  protected readonly isOrderPanelExpanded = signal<boolean>(false);

  private prevColorsStr = '';

  constructor() {
    effect(() => {
      const colorsStr = JSON.stringify(this.store.playerColors().map(c => c.id));
      if (this.prevColorsStr && this.prevColorsStr !== colorsStr) {
        // Auto-expand order panel when player order is swapped
        this.isOrderPanelExpanded.set(true);
      }
      this.prevColorsStr = colorsStr;
    });
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.openSwapPickerSlot() === null) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const insideMenu = target.closest('.swap-dropdown-menu');
    const insideButton = target.closest('.swap-trigger-btn');
    if (!insideMenu && !insideButton) {
      this.openSwapPickerSlot.set(null);
    }
  }

  protected toggleOrderPanelExpand(): void {
    this.isOrderPanelExpanded.update(v => !v);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.openSwapPickerSlot() !== null) {
      event.preventDefault();
      event.stopPropagation();
      this.openSwapPickerSlot.set(null);
    }
  }

  protected readonly playerOrderList = computed(() => {
    const playerColors = this.store.playerColors();
    const currentTurnIdx = this.store.currentTurnIndex();
    const isRound1 = this.store.isRound1Placement();

    return playerColors.map((color, idx) => {
      const isPlacedInRound1 = idx < currentTurnIdx;
      const isActive = idx === currentTurnIdx;
      const canSwap = isRound1 && idx >= currentTurnIdx;
      return {
        color,
        slotIndex: idx,
        turnOrder: idx + 1,
        name: this.store.getPlayerName(color.id),
        isPlacedInRound1,
        isActive,
        canSwap,
      };
    });
  });

  protected readonly rankingRows = computed<PlayerRankingRow[]>(() => {
    const playerColors = this.store.playerColors();
    const scoredVertices = this.store.scoredVertices();
    const placements = this.store.placedSettlements();

    // Build a vertex score lookup
    const vertexScoreMap = new Map<string, number>();
    for (const v of scoredVertices) {
      vertexScoreMap.set(v.id, v.rawScore);
    }

    // For each player, compute totalScore from their settlements
    const playerData: { playerColor: PlayerColor; turnOrder: number; totalScore: number }[] =
      playerColors.map((color, idx) => {
        const mySettlements = placements.filter(s => s.playerColorId === color.id);
        let totalScore = 0;
        if (mySettlements.length > 0) {
          totalScore = mySettlements.reduce(
            (sum, s) => sum + (vertexScoreMap.get(s.vertexId) ?? 0),
            0,
          );
        }
        return { playerColor: color, turnOrder: idx + 1, totalScore };
      });

    // Sort descending by totalScore
    playerData.sort((a, b) => b.totalScore - a.totalScore);

    // Apply dense tie-ranking rule: group by exact totalScore equality
    const rows: PlayerRankingRow[] = [];
    let currentRank = 1;
    let i = 0;
    while (i < playerData.length) {
      const groupScore = playerData[i].totalScore;
      const groupStart = i;
      while (i < playerData.length && Math.abs(playerData[i].totalScore - groupScore) < 1e-6) {
        i++;
      }
      for (let j = groupStart; j < i; j++) {
        rows.push({ ...playerData[j], productionRank: currentRank });
      }
      currentRank++;
    }

    return rows;
  });

  protected toggleSwapPicker(slotIndex: number): void {
    this.openSwapPickerSlot.update(current => (current === slotIndex ? null : slotIndex));
  }

  protected swapPlayers(slotA: number, slotB: number): void {
    this.store.swapPlayerOrder(slotA, slotB);
    this.openSwapPickerSlot.set(null);
  }

  protected getSwappableTargets(slotIndex: number) {
    return this.playerOrderList().filter(p => p.canSwap && p.slotIndex !== slotIndex);
  }

  protected colorName(color: PlayerColor): string {
    return this.store.getPlayerName(color.id);
  }

  protected formatScore(score: number): string {
    if (this.store.scoreFormat() === 'percentage') {
      return `${(score * 100).toFixed(1)}%`;
    }
    return score.toFixed(3);
  }
}
