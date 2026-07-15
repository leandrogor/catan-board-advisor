import { Component, inject, computed } from '@angular/core';
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

    // Apply 1224 tie-ranking rule: group by exact totalScore equality
    const rows: PlayerRankingRow[] = [];
    let runningCount = 0;
    let i = 0;
    while (i < playerData.length) {
      const groupScore = playerData[i].totalScore;
      const groupStart = i;
      while (i < playerData.length && playerData[i].totalScore === groupScore) {
        i++;
      }
      const groupRank = 1 + runningCount;
      for (let j = groupStart; j < i; j++) {
        rows.push({ ...playerData[j], productionRank: groupRank });
      }
      runningCount += i - groupStart;
    }

    return rows;
  });

  protected colorName(color: PlayerColor): string {
    const t = this.i18n.t();
    const map: Record<PlayerColor['id'], string> = {
      red: t.colorRed,
      blue: t.colorBlue,
      mustard: t.colorMustard,
      cream: t.colorCream,
      green: t.colorGreen,
      chocolate: t.colorChocolate,
    };
    return map[color.id];
  }

  protected formatScore(score: number): string {
    if (this.store.scoreFormat() === 'percentage') {
      return `${(score * 100).toFixed(1)}%`;
    }
    return score.toFixed(3);
  }
}
