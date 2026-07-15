import { Component, inject, computed, signal } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PlayerColor } from '../../models/player-color.model';

interface TimelinePoint {
  x: number;
  y: number;
  score: number;
  idx: number;
  desc: string;
  playerColorId: string;
}

interface ProductionPoint {
  x: number;
  y: number;
  val: number;
  idx: number;
  desc: string;
  playerColorId: string;
}

@Component({
  selector: 'app-game-stats-panel',
  templateUrl: './game-stats-panel.component.html',
  styleUrl: './game-stats-panel.component.scss',
  imports: [],
})
export class GameStatsPanelComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly activeTab = signal<'progress' | 'projection'>('progress');
  protected readonly zoomedChart = signal<'vp' | 'prod' | null>(null);

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
    return map[color.id] ?? color.id;
  }

  protected formatProduction(val: number): string {
    if (this.store.scoreFormat() === 'percentage') {
      return `${(val * 100).toFixed(1)}%`;
    }
    return val.toFixed(3);
  }

  /**
   * Filtered history starting from setup (index 0).
   * Generates grid coordinates for Victory Points line chart.
   */
  protected readonly vpPaths = computed(() => {
    const history = this.store.gameHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allScores = history.flatMap(e => Object.values(e.scores));
    const maxScore = Math.max(10, ...allScores);

    return colors.map(color => {
      const points: TimelinePoint[] = history.map((entry, idx) => {
        // Horizontal mapping: 50px margin left, 410px span (total viewBox width 500)
        const x = total <= 1 ? 250 : 50 + (idx / (total - 1)) * 410;
        // Vertical mapping: Y=170 is VP=2, Y=30 is maxScore.
        const score = entry.scores[color.id] ?? 2;
        const y = 170 - ((score - 2) / (maxScore - 2)) * 130;
        return { x, y, score, idx, desc: entry.description, playerColorId: entry.playerColorId };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        color,
        points,
        pathD,
      };
    });
  });

  /**
   * Generates grid coordinates for expected production engine line chart.
   */
  protected readonly prodPaths = computed(() => {
    const history = this.store.gameHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allYields = history.flatMap(e => Object.values(e.avgProd));
    const maxYield = Math.max(0.5, ...allYields);

    return colors.map(color => {
      const points: ProductionPoint[] = history.map((entry, idx) => {
        const x = total <= 1 ? 250 : 50 + (idx / (total - 1)) * 410;
        const val = entry.avgProd[color.id] ?? 0;
        // Vertical mapping: Y=170 is Prod=0, Y=30 is maxYield.
        const y = 170 - (val / maxYield) * 130;
        return { x, y, val, idx, desc: entry.description, playerColorId: entry.playerColorId };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        color,
        points,
        pathD,
      };
    });
  });

  /**
   * Dynamic horizontal grids for the VP chart.
   */
  protected readonly vpGridLines = computed(() => {
    const history = this.store.gameHistory();
    if (history.length === 0) return [];
    const allScores = history.flatMap(e => Object.values(e.scores));
    const maxScore = Math.max(10, ...allScores);

    const steps = [2, 4, 6, 8, 10];
    if (maxScore > 10) {
      steps.push(maxScore);
    }
    const uniqueSteps = Array.from(new Set(steps)).sort((a, b) => a - b);

    return uniqueSteps.map(score => {
      const y = 170 - ((score - 2) / (maxScore - 2)) * 130;
      return { score, y };
    });
  });

  /**
   * Dynamic horizontal grids for the production chart.
   */
  protected readonly prodGridLines = computed(() => {
    const history = this.store.gameHistory();
    if (history.length === 0) return [];
    const allYields = history.flatMap(e => Object.values(e.avgProd));
    const maxYield = Math.max(0.5, ...allYields);

    // Provide 4 divisions
    const stepVal = maxYield / 4;
    const steps = [0, stepVal, stepVal * 2, stepVal * 3, maxYield];

    return steps.map(val => {
      const y = 170 - (val / maxYield) * 130;
      return { val, y };
    });
  });

  /**
   * Dynamic X-axis tick positions and labels.
   */
  protected readonly xAxisTicks = computed(() => {
    const history = this.store.gameHistory();
    if (history.length <= 1) return [];

    const total = history.length;
    const ticks: { label: string; x: number }[] = [];
    const startText = this.i18n.lang() === 'es' ? 'Inicio' : 'Start';

    if (total <= 6) {
      history.forEach((_, idx) => {
        const x = 50 + (idx / (total - 1)) * 410;
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    } else {
      const indices = [0, Math.floor(total * 0.33), Math.floor(total * 0.66), total - 1];
      const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
      uniqueIndices.forEach(idx => {
        const x = 50 + (idx / (total - 1)) * 410;
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    }
    return ticks;
  });

  /**
   * Reverse chronological event log of the active game.
   */
  protected readonly gameLog = computed(() => {
    const history = this.store.gameHistory();
    if (history.length <= 1) return [];

    // Skip start entry, show newest first
    const entries = history.slice(1);
    entries.reverse();
    return entries.map(entry => {
      const playerColor = this.store.playerColors().find(c => c.id === entry.playerColorId);
      return {
        entry,
        playerColor,
      };
    });
  });

  /**
   * Qualitative engine strength and estimated rounds projection.
   */
  protected readonly projections = computed(() => {
    const scores = this.store.playerScores();
    const playerCount = this.store.playerCount();

    const list = scores.map(row => {
      const currentVP = row.score;
      const vpsNeeded = Math.max(0, 10 - currentVP);
      const avgProd = row.avgProd;
      const rRound = avgProd * playerCount;

      let roundsRange = '—';
      let speedClass: string;
      let speedTextKey:
        'statsEngineSlow' | 'statsEngineMedium' | 'statsEngineFast' | 'statsRoundsWon';
      const sortRounds = rRound >= 0.05 ? vpsNeeded / rRound : Infinity;

      if (vpsNeeded === 0) {
        roundsRange = '0';
        speedClass = 'won';
        speedTextKey = 'statsRoundsWon'; // Won! 🏆
      } else if (rRound >= 0.05) {
        const minRounds = Math.round((vpsNeeded * 6.0) / rRound);
        const maxRounds = Math.round((vpsNeeded * 10.5) / rRound);
        const lower = Math.max(1, minRounds);
        const upper = Math.max(lower + 1, maxRounds);

        const isEs = this.i18n.lang() === 'es';
        roundsRange = isEs ? `${lower} - ${upper} rondas` : `${lower} - ${upper} rounds`;

        if (rRound >= 3.0) {
          speedClass = 'fast';
          speedTextKey = 'statsEngineFast';
        } else if (rRound >= 1.5) {
          speedClass = 'medium';
          speedTextKey = 'statsEngineMedium';
        } else {
          speedClass = 'slow';
          speedTextKey = 'statsEngineSlow';
        }
      } else {
        speedClass = 'slow';
        speedTextKey = 'statsEngineSlow';
      }

      return {
        color: row.color,
        score: currentVP,
        avgProd,
        roundsRange,
        speedClass,
        speedTextKey,
        sortRounds,
      };
    });

    list.sort((a, b) => {
      if (a.sortRounds !== b.sortRounds) {
        return a.sortRounds - b.sortRounds;
      }
      return b.avgProd - a.avgProd;
    });

    return list;
  });

  /**
   * Bar dimensions for Expected Production Comparison Bar Chart
   */
  protected readonly expectedYieldBars = computed(() => {
    const projList = this.projections();
    if (projList.length === 0) return [];

    const maxProd = Math.max(0.5, ...projList.map(s => s.avgProd));

    return projList.map(p => {
      const pct = (p.avgProd / maxProd) * 100;
      const scoreRow = this.store.playerScores().find(s => s.color.id === p.color.id);
      const settlements = scoreRow?.settlementsCount ?? 0;
      const cities = scoreRow?.citiesCount ?? 0;

      return {
        color: p.color,
        val: p.avgProd,
        pct,
        settlements,
        cities,
      };
    });
  });

  protected getSpeedLabel(
    key: 'statsEngineSlow' | 'statsEngineMedium' | 'statsEngineFast' | 'statsRoundsWon',
  ): string {
    const t = this.i18n.t();
    const map: Record<typeof key, string> = {
      statsEngineSlow: t.statsEngineSlow,
      statsEngineMedium: t.statsEngineMedium,
      statsEngineFast: t.statsEngineFast,
      statsRoundsWon: t.statsRoundsWon,
    };
    return map[key];
  }

  /**
   * Zoomed VP lines and paths
   */
  protected readonly zoomVpPaths = computed(() => {
    const history = this.store.gameHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allScores = history.flatMap(e => Object.values(e.scores));
    const maxScore = Math.max(10, ...allScores);

    return colors.map(color => {
      const points = history.map((entry, idx) => {
        const x = total <= 1 ? 350 : 60 + (idx / (total - 1)) * 620;
        const score = entry.scores[color.id] ?? 2;
        const y = 250 - ((score - 2) / (maxScore - 2)) * 210;
        return { x, y, score };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        color,
        points,
        pathD,
      };
    });
  });

  /**
   * Zoomed production lines and paths
   */
  protected readonly zoomProdPaths = computed(() => {
    const history = this.store.gameHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allYields = history.flatMap(e => Object.values(e.avgProd));
    const maxYield = Math.max(0.5, ...allYields);

    return colors.map(color => {
      const points = history.map((entry, idx) => {
        const x = total <= 1 ? 350 : 60 + (idx / (total - 1)) * 620;
        const val = entry.avgProd[color.id] ?? 0;
        const y = 250 - (val / maxYield) * 210;
        return { x, y, val };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        color,
        points,
        pathD,
      };
    });
  });

  /**
   * Zoomed VP grid lines
   */
  protected readonly zoomVpGridLines = computed(() => {
    const lines = this.vpGridLines();
    const history = this.store.gameHistory();
    if (history.length === 0) return [];
    const allScores = history.flatMap(e => Object.values(e.scores));
    const maxScore = Math.max(10, ...allScores);

    return lines.map(line => {
      const y = 250 - ((line.score - 2) / (maxScore - 2)) * 210;
      return { score: line.score, y };
    });
  });

  /**
   * Zoomed production grid lines
   */
  protected readonly zoomProdGridLines = computed(() => {
    const lines = this.prodGridLines();
    const history = this.store.gameHistory();
    if (history.length === 0) return [];
    const allYields = history.flatMap(e => Object.values(e.avgProd));
    const maxYield = Math.max(0.5, ...allYields);

    return lines.map(line => {
      const y = 250 - (line.val / maxYield) * 210;
      return { val: line.val, y };
    });
  });

  /**
   * Zoomed X-axis ticks
   */
  protected readonly zoomXAxisTicks = computed(() => {
    const history = this.store.gameHistory();
    if (history.length <= 1) return [];

    const total = history.length;
    const ticks: { label: string; x: number }[] = [];
    const startText = this.i18n.lang() === 'es' ? 'Inicio' : 'Start';

    if (total <= 10) {
      history.forEach((_, idx) => {
        const x = 60 + (idx / (total - 1)) * 620;
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    } else {
      const indices = [
        0,
        Math.floor(total * 0.25),
        Math.floor(total * 0.5),
        Math.floor(total * 0.75),
        total - 1,
      ];
      const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
      uniqueIndices.forEach(idx => {
        const x = 60 + (idx / (total - 1)) * 620;
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    }
    return ticks;
  });

  protected close(): void {
    this.store.gameStatsPanelOpen.set(false);
  }
}
