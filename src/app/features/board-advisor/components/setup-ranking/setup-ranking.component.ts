import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PlayerColor } from '../../models/player-color.model';

interface PlayerRankingRow {
  playerColor: PlayerColor;
  turnOrder: number; // 1-based index in playerColors
  avgScore: number;
  productionRank: number; // 1224 rule
}

@Component({
  selector: 'app-setup-ranking',
  template: `
    @if (store.appPhase() === 'results' && store.isSetupComplete()) {
      <div
        class="mx-3 mb-3 rounded-2xl border border-indigo-200 dark:border-indigo-800
               bg-linear-to-br from-indigo-50 to-violet-50
               dark:from-indigo-950/40 dark:to-violet-950/30
               overflow-hidden shadow-lg"
        style="animation: slideInUp 0.35s ease"
      >
        <!-- Header -->
        <div
          class="px-4 py-3 border-b border-indigo-200 dark:border-indigo-800 bg-indigo-600/10 dark:bg-indigo-500/10 flex items-center gap-2"
        >
          <span class="text-lg">🏆</span>
          <h3 class="font-bold text-indigo-900 dark:text-indigo-100 text-sm">
            {{ i18n.t().rankingTitle }}
          </h3>
        </div>

        <!-- Column headers -->
        <div
          class="grid grid-cols-[3rem_1.5rem_1fr_auto] gap-x-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-indigo-100 dark:border-indigo-900/50"
        >
          <span>{{ i18n.t().rankingProdRank }}</span>
          <span class="text-center">{{ i18n.t().rankingTurnOrder }}</span>
          <span></span>
          <span class="text-right">{{ i18n.t().rankingScore }}</span>
        </div>

        <!-- Rows -->
        @for (row of rankingRows(); track row.playerColor.id) {
          <div
            class="grid grid-cols-[3rem_1.5rem_1fr_auto] gap-x-2 items-center px-4 py-2.5
                   border-b border-indigo-100/70 dark:border-indigo-900/30 last:border-0
                   hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
            [class.bg-indigo-100/40]="store.myPlayerColorId() === row.playerColor.id"
            [class.dark:bg-indigo-950/40]="store.myPlayerColorId() === row.playerColor.id"
          >
            <!-- Production rank -->
            <span class="text-sm font-bold text-indigo-700 dark:text-indigo-300">
              #{{ row.productionRank }}
            </span>

            <!-- Turn order -->
            <span class="text-xs text-center text-slate-500 dark:text-slate-400 font-medium">
              ({{ row.turnOrder }})
            </span>

            <!-- Color swatch + name -->
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="inline-block w-4 h-4 rounded-full shadow-sm ring-1 ring-white dark:ring-slate-600 shrink-0"
                [style.background-color]="row.playerColor.hex"
              ></span>
              <span class="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {{ colorName(row.playerColor) }}
                @if (store.myPlayerColorId() === row.playerColor.id) {
                  <span
                    class="ml-1.5 inline-block text-[9px] font-extrabold uppercase bg-indigo-600 dark:bg-indigo-500 text-white px-1.5 py-0.5 rounded-sm"
                  >
                    {{ i18n.t().isMeLabel }}
                  </span>
                }
              </span>
            </div>

            <!-- Score -->
            <span
              class="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums"
            >
              {{ formatScore(row.avgScore) }}
            </span>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
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

    // For each player, compute avgScore from their 2 settlements
    const playerData: { playerColor: PlayerColor; turnOrder: number; avgScore: number }[] =
      playerColors.map((color, idx) => {
        const mySettlements = placements.filter(s => s.playerColorId === color.id);
        let avgScore = 0;
        if (mySettlements.length > 0) {
          const total = mySettlements.reduce(
            (sum, s) => sum + (vertexScoreMap.get(s.vertexId) ?? 0),
            0,
          );
          avgScore = total / mySettlements.length;
        }
        return { playerColor: color, turnOrder: idx + 1, avgScore };
      });

    // Sort descending by avgScore
    playerData.sort((a, b) => b.avgScore - a.avgScore);

    // Apply 1224 tie-ranking rule: group by exact avgScore equality
    const rows: PlayerRankingRow[] = [];
    let runningCount = 0;
    let i = 0;
    while (i < playerData.length) {
      const groupScore = playerData[i].avgScore;
      const groupStart = i;
      while (i < playerData.length && playerData[i].avgScore === groupScore) {
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
